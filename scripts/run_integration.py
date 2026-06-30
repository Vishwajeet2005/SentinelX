import os
import json
import time
from kafka import KafkaConsumer

KAFKA_BROKER = os.environ.get('KAFKA_BROKER', 'localhost:9092')
ALERTS_TOPIC = 'sentinx_alerts'

def main():
    print("=" * 60)
    print("SentinX Integration Test — Admin Dashboard Mock")
    print("=" * 60)
    print(f"Connecting to Kafka at {KAFKA_BROKER}...")
    
    try:
        consumer = KafkaConsumer(
            ALERTS_TOPIC,
            bootstrap_servers=[KAFKA_BROKER],
            auto_offset_reset='latest',
            group_id='admin-dashboard-listener',
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        print(f"Connected! Listening for Ban Alerts on topic: {ALERTS_TOPIC}")
    except Exception as e:
        print(f"Failed to connect to Kafka: {e}")
        return

    print("Awaiting ML Inference events...\n")
    
    try:
        for message in consumer:
            alert = message.value
            print("\n[BANNED] " + "!"*40)
            print(f"[BANNED] BAN COMMAND ISSUED TO GAMESERVER")
            print(f"[BANNED] TARGET CLIENT ID: {alert['client_id']}")
            print(f"[BANNED] REASON: ML Anomaly Score {alert['anomaly_score']:.4f}")
            print(f"[BANNED] MODEL: {alert.get('model', 'Unknown')}")
            print("[BANNED] " + "!"*40 + "\n")
            
    except KeyboardInterrupt:
        print("\nShutting down Integration Listener.")

if __name__ == "__main__":
    main()
