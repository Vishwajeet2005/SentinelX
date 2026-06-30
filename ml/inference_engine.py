import json
import logging
import time
import os
import math
import numpy as np
import torch
import torch.nn as nn
import joblib
from kafka import KafkaConsumer, KafkaProducer
from prometheus_client import start_http_server, Counter, Histogram, Gauge

# ──────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SentinX-Autoencoder-Engine")

# ──────────────────────────────────────────────
# PROMETHEUS METRICS
# ──────────────────────────────────────────────
FRAMES_PROCESSED = Counter('sentinx_ml_frames_processed_total', 'Total number of telemetry frames evaluated')
EVALUATIONS = Counter('sentinx_ml_evaluations_total', 'Total number of client sequence evaluations')
ALERTS_FIRED = Counter('sentinx_ml_alerts_total', 'Total number of cheating alerts fired')
INFERENCE_LATENCY = Histogram('sentinx_ml_inference_latency_seconds', 'Latency of PyTorch forward pass', buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25))
CURRENT_MSE = Gauge('sentinx_ml_latest_mse', 'The MSE Reconstruction Error of the most recently evaluated client')

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
INPUT_TOPIC = 'sentinx_telemetry'
ALERTS_TOPIC = 'sentinx_alerts'

PTH_MODEL_PATH = 'models/behavior_autoencoder_v1.pth'
SCALER_PATH = 'models/scaler.pkl'

FEATURES = 6
SEQUENCE_LENGTH = 60
HONEYPOT_POS = (5000.0, 5000.0, 100.0)

# ──────────────────────────────────────────────
# MODEL DEFINITION (Must match train_model.py)
# ──────────────────────────────────────────────
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

# ──────────────────────────────────────────────
# MAIN INFERENCE PIPELINE
# ──────────────────────────────────────────────
def main():
    logger.info("Initializing SentinX Unsupervised Autoencoder Engine...")
    
    # Start Prometheus metrics server on port 8000
    start_http_server(8000)
    logger.info("Prometheus metrics server started on port 8000")
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # 1. Load Scaler
    if os.path.exists(SCALER_PATH):
        try:
            scaler = joblib.load(SCALER_PATH)
            logger.info(f"Loaded feature scaler from {SCALER_PATH}")
        except Exception as e:
            logger.error(f"Failed to load scaler: {e}")
            return
    else:
        logger.error(f"Scaler not found at {SCALER_PATH}. Exiting.")
        return

    # 2. Load PyTorch Autoencoder Model
    model = SentinXAutoencoder().to(device)
    if os.path.exists(PTH_MODEL_PATH):
        try:
            model.load_state_dict(torch.load(PTH_MODEL_PATH, map_location=device))
            model.eval()
            logger.info(f"Successfully loaded Autoencoder state from {PTH_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Failed to load PyTorch weights: {e}")
            return
    else:
        logger.error(f"Model not found at {PTH_MODEL_PATH}. Exiting.")
        return

    criterion = nn.MSELoss()

    # 3. Kafka Connection
    consumer = None
    producer = None
    retry_count = 0
    while retry_count < 10:
        try:
            consumer = KafkaConsumer(
                INPUT_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='latest',
                group_id='sentinx-autoencoder-group-v1',
                value_deserializer=lambda x: x.decode('utf-8')
            )
            producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda x: json.dumps(x).encode('utf-8')
            )
            logger.info(f"Connected to Kafka at {KAFKA_BROKER}")
            break
        except Exception as e:
            logger.warning(f"Waiting for Kafka {KAFKA_BROKER} to become available... ({e})")
            time.sleep(5)
            retry_count += 1

    if not consumer or not producer:
        logger.error("Failed to connect to Kafka. Exiting.")
        return

    logger.info(f"Listening for raw telemetry on topic '{INPUT_TOPIC}'...")

    for message in consumer:
        try:
            payload = json.loads(message.value)
        except json.JSONDecodeError as e:
            logger.warning(f"Dropped malformed JSON payload: {e}")
            continue

        client_id = payload.get('client_id')
        frames = payload.get('frames', [])

        if not frames:
            continue

        seq_len = len(frames)
        FRAMES_PROCESSED.inc(seq_len)
        
        feature_matrix = []
        interpolated_count = 0
        esp_detected = False
        
        for f in frames:
            if f.get('IsInterpolated', 0) == 1:
                interpolated_count += 1
            feature_matrix.append([
                f['PosX'], f['PosY'], f['PosZ'], 
                f['Pitch'], f['Yaw'], f['FrameDeltaMS']
            ])
            
            # ESP Honeypot Check (Deterministic)
            if not esp_detected:
                dx = HONEYPOT_POS[0] - f['PosX']
                dy = HONEYPOT_POS[1] - f['PosY']
                dz = HONEYPOT_POS[2] - f['PosZ']
                dist_xy = math.sqrt(dx*dx + dy*dy)
                
                target_yaw = math.degrees(math.atan2(dy, dx))
                target_pitch = math.degrees(math.atan2(dz, dist_xy))
                
                # If they snap precisely to the invisible entity within 0.5 degrees
                if abs(f['Yaw'] - target_yaw) < 0.5 and abs(f['Pitch'] - target_pitch) < 0.5:
                    esp_detected = True
        
        if esp_detected:
            ALERTS_FIRED.inc()
            logger.error(f"[ALERT] Client {client_id} FLAG! WALLHACK/ESP Detected! Snapped to Honeypot.")
            alert = {
                'client_id': client_id,
                'anomaly_score': 1.0,
                'timestamp_ms': payload.get('timestamp_ms'),
                'action': 'WALLHACK_DETECTED',
                'model': 'Deterministic_Honeypot_v1',
                'alert_timestamp': int(time.time() * 1000),
                'evidence': feature_matrix
            }
            producer.send(ALERTS_TOPIC, value=alert)
            continue # Bypass PyTorch ML Inference completely!
        
        if seq_len < SEQUENCE_LENGTH:
            padding = [[0.0] * FEATURES for _ in range(SEQUENCE_LENGTH - seq_len)]
            feature_matrix.extend(padding)
        else:
            feature_matrix = feature_matrix[:SEQUENCE_LENGTH]
            
        X = np.array(feature_matrix, dtype=np.float32)
        
        X_deltas = np.zeros_like(X)
        X_deltas[1:, :5] = np.diff(X[:, :5], axis=0)
        X_deltas[0, :5] = X_deltas[1, :5]
        X_deltas[:, 5] = X[:, 5]
        
        try:
            X_scaled = scaler.transform(X_deltas)
        except Exception as e:
            logger.error(f"Scaler transformation error: {e}")
            continue
            
        input_tensor = torch.tensor(X_scaled.reshape(1, SEQUENCE_LENGTH, FEATURES), dtype=torch.float32).to(device)

        with INFERENCE_LATENCY.time():
            with torch.no_grad():
                try:
                    reconstructed_tensor = model(input_tensor)
                    # Calculate MSE Reconstruction Error
                    loss = criterion(reconstructed_tensor, input_tensor)
                    mse_error = float(loss.item())
                except Exception as e:
                    logger.error(f"PyTorch inference error: {e}")
                    continue

        EVALUATIONS.inc()
        CURRENT_MSE.set(mse_error)

        # SECURITY PATCH: Interpolation Penalty (Lag Switch Cheat Laundering Defense)
        if interpolated_count > 0:
            penalty = 1.0 + (interpolated_count * 0.1)
            mse_error *= penalty
            logger.info(f"Applied Interpolation Penalty {penalty:.2f}x to Client {client_id}")

        # Map MSE to a generic anomaly score 0.0 -> 1.0 for the dashboard UI
        # Typical MSE for normal data is usually < 0.1. We cap it at 2.0.
        anomaly_score = min(mse_error / 2.0, 1.0)
        
        logger.info(f"Client {client_id} | Frames: {seq_len} | Interp: {interpolated_count} | MSE: {mse_error:.4f} | Scaled Anomaly: {anomaly_score:.4f}")

        # Alert Threshold (MSE > 0.4 usually means a huge deviation)
        if mse_error >= 0.40 or interpolated_count > 5:
            ALERTS_FIRED.inc()
            
            action_type = 'BAN_EVALUATION'
            if interpolated_count > 5:
                action_type = 'LAG_SWITCH_DETECTED'
                logger.error(f"[ALERT] Client {client_id} FLAG! Lag Switch Detected! Interpolated: {interpolated_count}")
            else:
                logger.error(f"[ALERT] Client {client_id} FLAG! MSE Error: {mse_error:.4f} (Zero-Day Anomaly Detected)")
                
            alert = {
                'client_id': client_id,
                'anomaly_score': anomaly_score if interpolated_count <= 5 else 1.0,
                'timestamp_ms': payload.get('timestamp_ms'),
                'action': action_type,
                'model': 'SentinX_Autoencoder_v1',
                'alert_timestamp': int(time.time() * 1000),
                'evidence': feature_matrix
            }
            producer.send(ALERTS_TOPIC, value=alert)

if __name__ == "__main__":
    main()
