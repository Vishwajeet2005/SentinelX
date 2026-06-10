import json
import logging
import time
import os
from kafka import KafkaConsumer
from clickhouse_driver import Client

# ──────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SentinX-CH-Sink")

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
CLICKHOUSE_HOST = os.environ.get('CLICKHOUSE_HOST', 'localhost')
CLICKHOUSE_PORT = 9000
INPUT_TOPIC = 'sentinx_telemetry'
DATABASE = 'sentinx'
TABLE = 'telemetry_sequences'

def main():
    logger.info("Initializing SentinX ClickHouse Sink...")
    
    # 1. Connect to ClickHouse
    client = None
    retry_count = 0
    while retry_count < 10:
        try:
            client = Client(host=CLICKHOUSE_HOST, port=CLICKHOUSE_PORT)
            client.execute("SELECT 1")
            logger.info(f"Connected to ClickHouse at {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
            break
        except Exception as e:
            logger.warning(f"Waiting for ClickHouse... ({e})")
            time.sleep(5)
            retry_count += 1
            
    if not client:
        logger.error("Failed to connect to ClickHouse. Exiting.")
        return
        
    # Ensure DB and Table exist
    client.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE}")
    # Assume table is created by schema.sql or generate_data.py
    
    # 2. Connect to Kafka
    consumer = None
    retry_count = 0
    while retry_count < 10:
        try:
            consumer = KafkaConsumer(
                INPUT_TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                auto_offset_reset='latest',
                group_id='sentinx-clickhouse-sink-group',
                value_deserializer=lambda x: x.decode('utf-8')
            )
            logger.info(f"Connected to Kafka at {KAFKA_BROKER}")
            break
        except Exception as e:
            logger.warning(f"Waiting for Kafka {KAFKA_BROKER} to become available... ({e})")
            time.sleep(5)
            retry_count += 1
            
    if not consumer:
        logger.error("Failed to connect to Kafka. Exiting.")
        return
        
    logger.info(f"Listening for telemetry on '{INPUT_TOPIC}' to sink to ClickHouse...")
    
    buffer = []
    BUFFER_LIMIT = 500
    last_flush = time.time()
    
    def flush_buffer():
        if not buffer: return
        try:
            client.execute(f"INSERT INTO {DATABASE}.{TABLE} VALUES", buffer)
            logger.info(f"Sank {len(buffer)} sequences to ClickHouse.")
            buffer.clear()
        except Exception as e:
            logger.error(f"Failed to sink buffer to ClickHouse: {e}")
            
    for message in consumer:
        try:
            payload = json.loads(message.value)
            client_id = payload.get('client_id', 'unknown')
            frames = payload.get('frames', [])
            
            if not frames: continue
            
            # Format row
            # We assume label=0 and cheat_type='live' for incoming live data
            row = [
                f"live_{client_id}_{int(time.time()*1000)}", 
                time.strftime('%Y-%m-%d %H:%M:%S'), 
                0, 
                "live"
            ]
            
            # Extract up to 60 frames
            feat_count = 0
            for i in range(min(60, len(frames))):
                f = frames[i]
                row.extend([f['PosX'], f['PosY'], f['PosZ'], f['Pitch'], f['Yaw'], f['FrameDeltaMS']])
                feat_count += 1
                
            # Pad if < 60
            while feat_count < 60:
                row.extend([0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
                feat_count += 1
                
            buffer.append(row)
            
            if len(buffer) >= BUFFER_LIMIT or (time.time() - last_flush) > 5.0:
                flush_buffer()
                last_flush = time.time()
                
        except json.JSONDecodeError as e:
            logger.warning(f"Dropped malformed JSON payload: {e}")
            continue

if __name__ == "__main__":
    main()
