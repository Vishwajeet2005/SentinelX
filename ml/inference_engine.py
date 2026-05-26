import json
import logging
import time
import os
import numpy as np
from kafka import KafkaConsumer, KafkaProducer
import onnxruntime as ort

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SentinX-ONNX-Engine")

KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
INPUT_TOPIC = 'sentinx_telemetry'
ALERTS_TOPIC = 'sentinx_alerts'
ONNX_MODEL_PATH = 'models/behavior_detection_v1.onnx'

def main():
    logger.info("Initializing SentinX ML Inference Engine...")
    ort_session = None
    try:
        # Load the ONNX Anti-Cheat model
        # Expandable to CUDAExecutionProvider or TensorrtExecutionProvider for lightning-fast hardware acceleration
        ort_session = ort.InferenceSession(ONNX_MODEL_PATH, providers=['CPUExecutionProvider'])
        logger.info(f"Loaded ONNX model from {ONNX_MODEL_PATH}")
    except Exception as e:
        logger.warning(f"ONNX model missing or failed to load. Operating in Mock mode. Error: {e}")

    try:
        consumer = KafkaConsumer(
            INPUT_TOPIC,
            bootstrap_servers=[KAFKA_BROKER],
            auto_offset_reset='latest',
            group_id='sentinx-inference-group',
            value_deserializer=lambda x: x.decode('utf-8')
        )
        producer = KafkaProducer(
            bootstrap_servers=[KAFKA_BROKER],
            value_serializer=lambda x: json.dumps(x).encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Failed to connect to Kafka broker at {KAFKA_BROKER}: {e}")
        return

    logger.info(f"Listening for telemetry on {INPUT_TOPIC}...")

    for message in consumer:
        try:
            payload = json.loads(message.value)
        except json.JSONDecodeError as e:
            logger.warning(f"Dropped malformed telemetry payload: {e}")
            continue

        client_id = payload.get('client_id')
        frames = payload.get('frames', [])

        if not frames:
            continue

        # Extract features for LSTM/RNN tensor shape
        feature_matrix = []
        for f in frames:
            feature_matrix.append([
                f['PosX'], f['PosY'], f['PosZ'], 
                f['Pitch'], f['Yaw'], f['FrameDeltaMS']
            ])
        
        # Hardcoded Sequence Length for model tensor shape
        SEQ_LENGTH = 60
        seq_len = len(feature_matrix)
        
        if seq_len < SEQ_LENGTH:
            # Zero-pad short sequences
            padding = [[0.0] * 6 for _ in range(SEQ_LENGTH - seq_len)]
            feature_matrix.extend(padding)
        else:
            # Truncate overly long sequences
            feature_matrix = feature_matrix[:SEQ_LENGTH]
            
        input_tensor = np.array([feature_matrix], dtype=np.float32)

        if ort_session:
            # Execute inference
            input_name = ort_session.get_inputs()[0].name
            output_name = ort_session.get_outputs()[0].name
            scores = ort_session.run([output_name], {input_name: input_tensor})
            anomaly_score = float(scores[0][0][0])
        else:
            # Mock behavior scoring for structural blueprinting
            anomaly_score = np.random.uniform(0.0, 0.1) 

        # Evaluator Threshold 
        if anomaly_score > 0.85:
            logger.error(f"[ALERT] Client {client_id} FLAG! Anomaly Score: {anomaly_score:.4f}")
            alert = {
                'client_id': client_id,
                'anomaly_score': anomaly_score,
                'timestamp_ms': payload.get('timestamp_ms'),
                'action': 'BAN_EVALUATION'
            }
            producer.send(ALERTS_TOPIC, value=alert)
        else:
            logger.debug(f"Client {client_id} CLEAR. Score: {anomaly_score:.4f}")

if __name__ == "__main__":
    main()
