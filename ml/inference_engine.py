import json
import logging
import time
import os
import numpy as np
import torch
import torch.nn as nn
from kafka import KafkaConsumer, KafkaProducer

# ──────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SentinX-ML-Engine")

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
INPUT_TOPIC = 'sentinx_telemetry'
ALERTS_TOPIC = 'sentinx_alerts'
PTH_MODEL_PATH = 'models/behavior_detection_v1.pth'

FEATURES = 6
SEQUENCE_LENGTH = 60

# ──────────────────────────────────────────────
# MODEL DEFINITION (Must match train_model.py exactly)
# ──────────────────────────────────────────────
class SentinXLSTM(nn.Module):
    def __init__(self, input_size=FEATURES, hidden_size=64, num_layers=2):
        super(SentinXLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, 32)
        self.relu = nn.ReLU()
        self.out = nn.Linear(32, 1)
        self.sigmoid = nn.Sigmoid()
        
    def forward(self, x):
        lstm_out, (hn, cn) = self.lstm(x)
        final_timestep = lstm_out[:, -1, :]
        x = self.fc(final_timestep)
        x = self.relu(x)
        x = self.out(x)
        return self.sigmoid(x)

# ──────────────────────────────────────────────
# MAIN INFERENCE PIPELINE
# ──────────────────────────────────────────────
def main():
    logger.info("Initializing SentinX Deep Learning Inference Engine...")
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"Using compute device: {device}")
    
    model = SentinXLSTM().to(device)
    
    if os.path.exists(PTH_MODEL_PATH):
        try:
            # Map location allows loading a model trained on GPU into CPU edge nodes
            model.load_state_dict(torch.load(PTH_MODEL_PATH, map_location=device))
            model.eval()
            logger.info(f"Successfully loaded PyTorch state from {PTH_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Failed to load PyTorch weights: {e}. Exiting.")
            return
    else:
        logger.error(f"Model file not found at {PTH_MODEL_PATH}. Exiting.")
        return

    # Kafka Connection Retry Loop (Edge containers must be resilient)
    consumer = None
    producer = None
    retry_count = 0
    while retry_count < 10:
        try:
            consumer = KafkaConsumer(
                INPUT_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='latest',
                group_id='sentinx-inference-group-v2',
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
        logger.error("Failed to connect to Kafka after multiple retries. Exiting.")
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

        # Extract features
        feature_matrix = []
        for f in frames:
            feature_matrix.append([
                f['PosX'], f['PosY'], f['PosZ'], 
                f['Pitch'], f['Yaw'], f['FrameDeltaMS']
            ])
        
        seq_len = len(feature_matrix)
        
        # ML padding/truncation
        if seq_len < SEQUENCE_LENGTH:
            padding = [[0.0] * FEATURES for _ in range(SEQUENCE_LENGTH - seq_len)]
            feature_matrix.extend(padding)
        else:
            feature_matrix = feature_matrix[:SEQUENCE_LENGTH]
            
        # Shape: (Batch=1, Seq=60, Features=6)
        input_tensor = torch.tensor([feature_matrix], dtype=torch.float32).to(device)

        # Execute Deep Learning Inference
        with torch.no_grad():
            score_tensor = model(input_tensor)
            anomaly_score = float(score_tensor.item())

        logger.info(f"Evaluated Client {client_id} | Frames: {seq_len} | Score: {anomaly_score:.4f}")

        # Professional Alert Evaluation Threshold
        if anomaly_score >= 0.35:  # Lowered temporarily to validate Kafka pipeline
            logger.error(f"[ALERT] Client {client_id} FLAG! Anomaly Score: {anomaly_score:.4f} (Likely Cheater)")
            alert = {
                'client_id': client_id,
                'anomaly_score': anomaly_score,
                'timestamp_ms': payload.get('timestamp_ms'),
                'action': 'BAN_EVALUATION',
                'model': 'SentinXLSTM_v1',
                'alert_timestamp': int(time.time() * 1000)
            }
            producer.send(ALERTS_TOPIC, value=alert)
        else:
            logger.debug(f"Client {client_id} VERIFIED CLEAR. Score: {anomaly_score:.4f}")

if __name__ == "__main__":
    main()
