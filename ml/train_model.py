import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
CSV_PATH = 'sentinelx_dataset.csv'
MODEL_DIR = '../models'
ONNX_PATH = os.path.join(MODEL_DIR, 'behavior_detection_v1.onnx')

SEQUENCE_LENGTH = 60
FEATURES = 6
BATCH_SIZE = 64
EPOCHS = 10
LEARNING_RATE = 0.001

os.makedirs(MODEL_DIR, exist_ok=True)

# ──────────────────────────────────────────────
# DATASET DEFINITION
# ──────────────────────────────────────────────
class TelemetryDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32).unsqueeze(1) # shape (N, 1)
        
    def __len__(self):
        return len(self.y)
        
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

# ──────────────────────────────────────────────
# LSTM MODEL ARCHITECTURE
# ──────────────────────────────────────────────
class SentinXLSTM(nn.Module):
    def __init__(self, input_size=FEATURES, hidden_size=64, num_layers=2):
        super(SentinXLSTM, self).__init__()
        # Batch First means tensors are shape (Batch, Seq, Feature)
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        
        # Classifier Head
        self.fc = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.out = nn.Linear(32, 1)
        self.sigmoid = nn.Sigmoid()
        
    def forward(self, x):
        # x shape: (Batch, Seq=60, Features=6)
        lstm_out, (hn, cn) = self.lstm(x)
        
        # We only care about the output of the final timestep to make a classification
        final_timestep = lstm_out[:, -1, :]
        
        x = self.fc(final_timestep)
        x = self.relu(x)
        x = self.out(x)
        
        # Output probability between 0.0 (Normal) and 1.0 (Cheat)
        return self.sigmoid(x)

# ──────────────────────────────────────────────
# TRAINING PIPELINE
# ──────────────────────────────────────────────
def train():
    print("=" * 60)
    print("SentinX Model Trainer — LSTM Supervised Classifier")
    print("=" * 60)
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found. Run generate_data.py first!")
        return

    print("Loading dataset...")
    df = pd.read_csv(CSV_PATH)
    
    # Extract labels
    y = df['label'].values
    
    # Extract feature columns (360 columns)
    feat_names = ['PosX', 'PosY', 'PosZ', 'Pitch', 'Yaw', 'FrameDeltaMS']
    feature_cols = [f'{feat}_f{i}' for i in range(SEQUENCE_LENGTH) for feat in feat_names]
    
    X_flat = df[feature_cols].values
    
    # Reshape from (N, 360) back to (N, 60, 6)
    N = len(X_flat)
    X = X_flat.reshape(N, SEQUENCE_LENGTH, FEATURES)
    
    # Train/Val Split (80/20)
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Training data: {len(y_train)} sequences")
    print(f"Validation data: {len(y_val)} sequences")
    
    train_dataset = TelemetryDataset(X_train, y_train)
    val_dataset = TelemetryDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # Device configuration
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = SentinXLSTM().to(device)
    criterion = nn.BCELoss() # Binary Cross Entropy Loss for 0.0 -> 1.0 classification
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    print("\nStarting Training...")
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            
        # Validation
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                val_loss += loss.item()
                
                # Accuracy calculation
                predicted = (outputs > 0.5).float()
                total += batch_y.size(0)
                correct += (predicted == batch_y).sum().item()
                
        print(f"Epoch [{epoch+1}/{EPOCHS}] "
              f"Train Loss: {train_loss/len(train_loader):.4f} | "
              f"Val Loss: {val_loss/len(val_loader):.4f} | "
              f"Val Accuracy: {100 * correct / total:.2f}%")

    # ──────────────────────────────────────────────
    # PYTORCH EXPORT
    # ──────────────────────────────────────────────
    print("\nTraining Complete! Saving PyTorch model...")
    model.eval()
    
    pth_path = ONNX_PATH.replace('.onnx', '.pth')
    torch.save(model.state_dict(), pth_path)
    
    print(f"Model saved to: {pth_path}")
    print(f"Size: {os.path.getsize(pth_path) / 1024:.1f} KB")

if __name__ == "__main__":
    train()
