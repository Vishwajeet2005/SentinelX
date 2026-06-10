import os
import torch
import torch.nn as nn

# ──────────────────────────────────────────────
# MODEL DEFINITION (Must perfectly match train_model.py)
# ──────────────────────────────────────────────
FEATURES = 6
SEQUENCE_LENGTH = 60

class SentinXAutoencoder(nn.Module):
    def __init__(self, input_size=FEATURES, hidden_size=32, latent_size=8):
        super(SentinXAutoencoder, self).__init__()
        self.encoder_lstm = nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=True)
        self.encoder_fc = nn.Linear(hidden_size, latent_size)
        self.decoder_fc = nn.Linear(latent_size, hidden_size)
        self.decoder_lstm = nn.LSTM(hidden_size, input_size, num_layers=1, batch_first=True)
        
    def forward(self, x):
        _, (hn, _) = self.encoder_lstm(x)
        latent = self.encoder_fc(hn[-1, :, :])
        decoder_input = self.decoder_fc(latent)
        decoder_input_seq = decoder_input.unsqueeze(1).repeat(1, SEQUENCE_LENGTH, 1)
        reconstructed, _ = self.decoder_lstm(decoder_input_seq)
        return reconstructed

def export():
    print("Initializing ONNX Export sequence...")
    
    pth_path = 'models/behavior_autoencoder_v1.pth'
    onnx_path = 'models/behavior_autoencoder_v1.onnx'
    
    if not os.path.exists(pth_path):
        print(f"ERROR: {pth_path} not found. Mount the models directory correctly.")
        return
        
    # Load Model
    model = SentinXAutoencoder()
    model.load_state_dict(torch.load(pth_path, map_location='cpu'))
    model.eval()
    print(f"Loaded PyTorch Autoencoder from {pth_path}")
    
    # Create Dummy Input Tensor for ONNX Tracing
    # Shape: (Batch=1, Seq=60, Features=6)
    dummy_input = torch.randn(1, SEQUENCE_LENGTH, FEATURES)
    
    print("Tracing and Exporting to ONNX...")
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,          # Opset 14 is highly stable for LSTMs
        do_constant_folding=True,
        input_names=['input'],
        output_names=['reconstructed'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'reconstructed': {0: 'batch_size'}
        }
    )
    
    print(f"SUCCESS: ONNX Autoencoder exported to {onnx_path}")
    print(f"ONNX Model Size: {os.path.getsize(onnx_path) / 1024:.1f} KB")

if __name__ == "__main__":
    export()
