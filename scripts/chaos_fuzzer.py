import socket
import struct
import time
import hashlib
import hmac
import os
import argparse
import threading
import requests
import random

# CONFIG
UDP_IP = "127.0.0.1"
UDP_PORT = 8080
API_URL = "http://localhost:4000/api/v1"
SECRET_KEY = os.environ.get("HMAC_SECRET", "REPLACE_WITH_SECURE_32_BYTE_KEY").encode('utf-8')

# Pack a generic 60-frame payload
def create_payload(client_id, seq_id, inject_nan=False):
    frames_bytes = bytearray()
    now_ms = int(time.time() * 1000)
    frame_count = 60
    
    for i in range(frame_count):
        pos_x = float('nan') if inject_nan else float(random.randint(0, 1000))
        pos_y = float('inf') if inject_nan else float(random.randint(0, 1000))
        
        frame_data = struct.pack('<ffffffQII', 
            pos_x, pos_y, 100.0, 0.0, 0.0, 16.666, 
            now_ms - int((frame_count - i) * 16.666), 
            1, 0 
        )
        frames_bytes.extend(frame_data)
        
    nonce = int.from_bytes(os.urandom(4), 'little')
    header_no_hmac = struct.pack('<QQQII', client_id, seq_id, now_ms, nonce, frame_count)
    payload_to_hash = header_no_hmac + frames_bytes
    signature = hmac.new(SECRET_KEY, payload_to_hash, hashlib.sha256).digest()
    
    return signature + payload_to_hash

def flood_udp(threads=10, rate=5000):
    """Blast valid packets to test network buffer and Go channel saturation"""
    print(f"[*] Starting UDP Flood (Target: {rate} pps)")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    def worker(worker_id):
        client_id = 9000 + worker_id
        seq_id = 1
        while True:
            payload = create_payload(client_id, seq_id)
            sock.sendto(payload, (UDP_IP, UDP_PORT))
            seq_id += 1
            time.sleep(1.0 / (rate / threads))

    for i in range(threads):
        threading.Thread(target=worker, args=(i,), daemon=True).start()
    
    while True: time.sleep(1)

def poison_tensors():
    """Send NaN and Infinity to crash PyTorch Scaler or MSELoss"""
    print("[*] Starting Tensor Poisoning (NaN/Infinity Injection)")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    seq_id = 1
    while True:
        payload = create_payload(client_id=8888, seq_id=seq_id, inject_nan=True)
        sock.sendto(payload, (UDP_IP, UDP_PORT))
        print(f"Sent Poisoned Packet {seq_id}")
        seq_id += 1
        time.sleep(0.5)

def replay_attack(threads=50):
    """Send the EXACT SAME PACKET concurrently to test Go ReplayCache race condition"""
    print("[*] Starting Concurrent Replay Attack (Lock Contention Testing)")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    seq_id = 1
    while True:
        payload = create_payload(client_id=7777, seq_id=seq_id)
        
        def slam():
            for _ in range(10):
                sock.sendto(payload, (UDP_IP, UDP_PORT))
                
        threads_list = []
        for _ in range(threads):
            t = threading.Thread(target=slam)
            threads_list.append(t)
            t.start()
            
        for t in threads_list:
            t.join()
            
        print(f"Slammed {threads*10} identical copies of seq {seq_id} simultaneously")
        seq_id += 1
        time.sleep(1)

def api_flood(threads=20):
    """Flood the Node.js API to test Redis connection pool exhaustion"""
    print("[*] Starting API Connection Pool Flood")
    
    def hit_api():
        while True:
            try:
                # Generate a generic HMAC header
                payload_str = JSON.stringify({}) if False else "{}"
                sig = hmac.new(SECRET_KEY, payload_str.encode(), hashlib.sha256).hexdigest()
                res = requests.get(f"{API_URL}/players/1001/trust", headers={'x-sentinx-signature': sig}, timeout=1)
            except Exception:
                pass
                
    for _ in range(threads):
        threading.Thread(target=hit_api, daemon=True).start()
        
    while True: time.sleep(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SentinelX Chaos Fuzzer")
    parser.add_argument("mode", choices=["udp_flood", "poison_tensors", "replay_attack", "api_flood"], help="Chaos mode to run")
    args = parser.parse_args()
    
    if args.mode == "udp_flood": flood_udp()
    elif args.mode == "poison_tensors": poison_tensors()
    elif args.mode == "replay_attack": replay_attack()
    elif args.mode == "api_flood": api_flood()
