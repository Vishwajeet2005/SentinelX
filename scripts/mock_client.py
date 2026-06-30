import socket
import struct
import time
import math
import hashlib
import hmac
import os
import redis
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

UDP_IP = os.environ.get("EDGE_HOST", "127.0.0.1")
UDP_PORT = int(os.environ.get("EDGE_PORT", 8080))
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

print(f"Starting Unreal Engine Synthetic Data Generator...")
print(f"Targeting UDP {UDP_IP}:{UDP_PORT} | Dynamic AES-256-GCM + HMAC-SHA256 Enabled")

# 1. Connect to Redis (Simulating the Login API)
try:
    rdb = redis.from_url(REDIS_URL)
    rdb.ping()
    print(f"Connected to Redis at {REDIS_URL}")
except Exception as e:
    print(f"Failed to connect to Redis: {e}")
    exit(1)

# Simulated Player State
client_id = 1001
sequence_id = 1000

# 2. Generate Dynamic Session Key and push to Redis
# In a real game, the web API generates this and gives it to the client via HTTPS
raw_session_key = os.urandom(32)
rdb.setex(f"session:{client_id}", 3600, raw_session_key) # Expires in 1 hour
print(f"Generated Session Key for Client {client_id} and pushed to Redis")

SECRET_KEY = raw_session_key
AES_KEY = hashlib.sha256(SECRET_KEY).digest() # Ensure exactly 32 bytes for AES-256
aesgcm = AESGCM(AES_KEY)

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

pos_x, pos_y, pos_z = 0.0, 0.0, 100.0  # UE scales in cm (100cm = 1m)
vel_x, vel_y, vel_z = 0.0, 0.0, 0.0
pitch, yaw = 0.0, 0.0

# UE Constants
GRAVITY = -980.0         # UE default gravity (cm/s^2)
MAX_WALK_SPEED = 5000.0  # SPEEDHACK ENGAGED (50m/s, matches training distribution)
JUMP_Z_VELOCITY = 420.0  # cm/s
ACCELERATION = 20000.0   # SPEEDHACK ACCELERATION
FRICTION = 8.0
DELTA_MS = 16.666        # 60 FPS
DELTA_S = DELTA_MS / 1000.0

def generate_smooth_inputs(time_elapsed):
    """Simulate straight line injection to trigger speedhack detection"""
    input_x = 1.0
    input_y = 1.0
    target_pitch = 0.0
    target_yaw = 0.0
    jump = False
    return input_x, input_y, target_pitch, target_yaw, jump

start_time = time.time()

while True:
    # Dynamic Honeypot (Read from Redis or default if not set by ML engine)
    honeypot_raw = rdb.get("honeypot:current")
    if honeypot_raw:
        try:
            hp = json.loads(honeypot_raw.decode('utf-8'))
            HONEYPOT_POS = (hp['x'], hp['y'], hp['z'])
        except:
            HONEYPOT_POS = (5000.0, 5000.0, 100.0)
    else:
        HONEYPOT_POS = (5000.0, 5000.0, 100.0)

    frame_count = 60  # Batch 60 frames per packet (1 second of data)
    frames_bytes = bytearray()
    now_ms = int(time.time() * 1000)
    
    time_elapsed = time.time() - start_time
    
    for i in range(frame_count):
        # 1. Get Simulated Human Inputs
        in_x, in_y, tg_pitch, tg_yaw, jump = generate_smooth_inputs(time_elapsed + (i * DELTA_S))
        
        # 2. Process Physics
        if pos_z <= 0.0:
            pos_z = 0.0
            vel_z = 0.0
            vel_x -= vel_x * FRICTION * DELTA_S
            vel_y -= vel_y * FRICTION * DELTA_S
            vel_x += in_x * ACCELERATION * DELTA_S
            vel_y += in_y * ACCELERATION * DELTA_S
            speed = math.sqrt(vel_x**2 + vel_y**2)
            if speed > MAX_WALK_SPEED:
                vel_x = (vel_x / speed) * MAX_WALK_SPEED
                vel_y = (vel_y / speed) * MAX_WALK_SPEED
            if jump: vel_z = JUMP_Z_VELOCITY
        else:
            vel_z += GRAVITY * DELTA_S
            
        pos_x += vel_x * DELTA_S
        pos_y += vel_y * DELTA_S
        pos_z += vel_z * DELTA_S
        
        import random
        if random.random() < 0.05:
            pos_x = random.uniform(-25000.0, 25000.0)
            pos_y = random.uniform(-25000.0, 25000.0)
            
        pitch += (tg_pitch - pitch) * 10.0 * DELTA_S
        yaw += (tg_yaw - yaw) * 10.0 * DELTA_S
        
        # CHEAT: ESP WALLHACK SNAP
        if random.random() < 0.01:
            dx = HONEYPOT_POS[0] - pos_x
            dy = HONEYPOT_POS[1] - pos_y
            dz = HONEYPOT_POS[2] - pos_z
            dist_xy = math.sqrt(dx*dx + dy*dy)
            target_yaw = math.degrees(math.atan2(dy, dx))
            target_pitch = math.degrees(math.atan2(dz, dist_xy))
            yaw = target_yaw
            pitch = target_pitch
        
        frame_data = struct.pack('<ffffffQII', 
            pos_x, pos_y, pos_z, pitch, yaw, DELTA_MS, 
            now_ms - int((frame_count - i) * DELTA_MS), 
            1, 0
        )
        frames_bytes.extend(frame_data)
        
    nonce = int.from_bytes(os.urandom(4), 'little')
    
    # Pack header (excluding the HMAC prefix)
    header_no_hmac = struct.pack('<QQQII', client_id, sequence_id, now_ms, nonce, frame_count)
    plaintext_payload = header_no_hmac + frames_bytes
    
    # ENCRYPT-THEN-MAC PATTERN (AES-256-GCM)
    iv = os.urandom(12)
    ciphertext = aesgcm.encrypt(iv, plaintext_payload, None)
    
    # New Format: [8-byte ClientID] + [32-byte HMAC] + [12-byte IV] + [Ciphertext]
    # The signature covers the ClientID prefix + the encrypted body
    client_id_bytes = struct.pack('<Q', client_id)
    payload_to_hash = client_id_bytes + iv + ciphertext
    signature = hmac.new(SECRET_KEY, payload_to_hash, hashlib.sha256).digest()
    
    final_payload = client_id_bytes + signature + iv + ciphertext
    
    print(f"[Synthetic UE Data] Encrypted & Pushed Packet Seq {sequence_id} | Pos: ({int(pos_x)}, {int(pos_y)}, {int(pos_z)}) | Trap: {HONEYPOT_POS}")
    sock.sendto(final_payload, (UDP_IP, UDP_PORT))
    
    sequence_id += 1
    time.sleep(1.0)
