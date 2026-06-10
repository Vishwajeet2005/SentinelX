import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
CSV_PATH = 'sentinelx_dataset.csv'
MODEL_DIR = '../models'
PTH_PATH = os.path.join(MODEL_DIR, 'behavior_autoencoder_v1.pth')
SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')

SEQUENCE_LENGTH = 60
FEATURES = 6
BATCH_SIZE = 128
EPOCHS = 15
LEARNING_RATE = 0.001

os.makedirs(MODEL_DIR, exist_ok=True)

# ──────────────────────────────────────────────
# DATASET DEFINITION
# ──────────────────────────────────────────────
class TelemetryDataset(Dataset):
    def __init__(self, X):
        self.X = torch.tensor(X, dtype=torch.float32)
        
    def __len__(self):
        return len(self.X)
        
    def __getitem__(self, idx):
        # Autoencoder target is the input itself
        return self.X[idx], self.X[idx]

# ──────────────────────────────────────────────
# LSTM AUTOENCODER ARCHITECTURE
# ──────────────────────────────────────────────
class SentinXAutoencoder(nn.Module):
    def __init__(self, input_size=FEATURES, hidden_size=32, latent_size=8):
        super(SentinXAutoencoder, self).__init__()
        
        # Encoder
        self.encoder_lstm = nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=True)
        self.encoder_fc = nn.Linear(hidden_size, latent_size)
        
        # Decoder
        self.decoder_fc = nn.Linear(latent_size, hidden_size)
        self.decoder_lstm = nn.LSTM(hidden_size, input_size, num_layers=1, batch_first=True)
        
    def forward(self, x):
        # x shape: (Batch, Seq=60, Features=6)
        batch_size = x.size(0)
        
        # --- Encode ---
        # We only care about the final hidden state of the sequence to form the latent vector
        _, (hn, _) = self.encoder_lstm(x)
        final_hidden = hn[-1, :, :]  # Shape: (Batch, Hidden)
        latent = self.encoder_fc(final_hidden) # Shape: (Batch, Latent)
        
        # --- Decode ---
        # Reconstruct the sequence from the latent vector
        decoder_input = self.decoder_fc(latent) # Shape: (Batch, Hidden)
        
        # We repeat the hidden state for all 60 timesteps to feed the decoder LSTM
        decoder_input_seq = decoder_input.unsqueeze(1).repeat(1, SEQUENCE_LENGTH, 1) # Shape: (Batch, Seq, Hidden)
        
        reconstructed, _ = self.decoder_lstm(decoder_input_seq) # Shape: (Batch, Seq, Features)
        
        return reconstructed

# ──────────────────────────────────────────────
# TRAINING PIPELINE
# ──────────────────────────────────────────────
def train():
    print("=" * 60)
    print("SentinX Model Trainer — Unsupervised LSTM Autoencoder")
    print("=" * 60)
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: {CSV_PATH} not found. Run generate_data.py first!")
        return

    print("Loading dataset...")
    df = pd.read_csv(CSV_PATH)
    
    # We ONLY train on Normal data (label == 0)
    print(f"Total dataset size: {len(df)}")
    df_normal = df[df['label'] == 0]
    print(f"Filtering purely normal sequences for Unsupervised learning: {len(df_normal)}")
    
    # Extract feature columns
    feat_names = ['PosX', 'PosY', 'PosZ', 'Pitch', 'Yaw', 'FrameDeltaMS']
    feature_cols = [f'{feat}_f{i}' for i in range(SEQUENCE_LENGTH) for feat in feat_names]
    
    X_flat = df_normal[feature_cols].values
    
    # Reshape from (N, 360) back to (N, 60, 6)
    N = len(X_flat)
    X = X_flat.reshape(N, SEQUENCE_LENGTH, FEATURES)
    
    # --- FEATURE ENGINEERING ---
    # Convert absolute Pos/Pitch/Yaw into Deltas (Velocities/Rotations per frame)
    X_deltas = np.zeros_like(X)
    X_deltas[:, 1:, :5] = np.diff(X[:, :, :5], axis=1)
    X_deltas[:, 0, :5] = X_deltas[:, 1, :5]
    X_deltas[:, :, 5] = X[:, :, 5]
    X = X_deltas
    
    # Train/Val Split
    X_train, X_val = train_test_split(X, test_size=0.15, random_state=42)
    
    # --- SCALING ---
    print("Fitting StandardScaler...")
    scaler = StandardScaler()
    X_train_flat = X_train.reshape(-1, FEATURES)
    X_val_flat = X_val.reshape(-1, FEATURES)
    
    X_train_scaled = scaler.fit_transform(X_train_flat).reshape(X_train.shape)
    X_val_scaled = scaler.transform(X_val_flat).reshape(X_val.shape)
    
    joblib.dump(scaler, SCALER_PATH)
    print(f"Scaler saved to {SCALER_PATH}")
    
    print(f"Training data: {len(X_train)} sequences")
    print(f"Validation data: {len(X_val)} sequences")
    
    train_dataset = TelemetryDataset(X_train_scaled)
    val_dataset = TelemetryDataset(X_val_scaled)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = SentinXAutoencoder().to(device)
    criterion = nn.MSELoss() # Reconstruction Error
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
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                val_loss += loss.item()
                
        print(f"Epoch [{epoch+1}/{EPOCHS}] "
              f"Train MSE: {train_loss/len(train_loader):.4f} | "
              f"Val MSE: {val_loss/len(val_loader):.4f}")

    print("\nTraining Complete! Saving PyTorch Autoencoder model...")
    model.eval()
    
    torch.save(model.state_dict(), PTH_PATH)
    print(f"Model saved to: {PTH_PATH}")
    print(f"Size: {os.path.getsize(PTH_PATH) / 1024:.1f} KB")

if __name__ == "__main__":
    train()
