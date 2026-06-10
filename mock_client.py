import socket
import struct
import time
import math
import hashlib
import hmac
import os

# To load secrets if running locally alongside the backend
from dotenv import load_dotenv
load_dotenv()

UDP_IP = "127.0.0.1"
UDP_PORT = 8080
SECRET_KEY = os.getenv("HMAC_SECRET", "REPLACE_WITH_SECURE_32_BYTE_KEY").encode('utf-8')

print(f"Starting Unreal Engine Synthetic Data Generator...")
print(f"Targeting UDP {UDP_IP}:{UDP_PORT} | HMAC Enabled")

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# Simulated Player State
client_id = 1001
sequence_id = 1
pos_x, pos_y, pos_z = 0.0, 0.0, 100.0  # UE scales in cm (100cm = 1m)
vel_x, vel_y, vel_z = 0.0, 0.0, 0.0
pitch, yaw = 0.0, 0.0

# UE Constants
GRAVITY = -980.0         # UE default gravity (cm/s^2)
MAX_WALK_SPEED = 600.0   # cm/s
JUMP_Z_VELOCITY = 420.0  # cm/s
ACCELERATION = 2048.0    # cm/s^2
FRICTION = 8.0
DELTA_MS = 16.666        # 60 FPS
DELTA_S = DELTA_MS / 1000.0

def generate_smooth_inputs(time_elapsed):
    """Simulate human-like WASD input and mouse movement using sine waves"""
    # Smooth, wandering WASD input (-1.0 to 1.0)
    input_x = math.sin(time_elapsed * 0.5)
    input_y = math.cos(time_elapsed * 0.3)
    
    # Smooth mouse aiming (drifting)
    target_pitch = math.sin(time_elapsed * 0.1) * 20.0
    target_yaw = (time_elapsed * 15.0) % 360.0  # Slowly spinning around
    
    # Jump occasionally (every ~5 seconds)
    jump = (time_elapsed % 5.0) < 0.1
    
    return input_x, input_y, target_pitch, target_yaw, jump

start_time = time.time()

while True:
    frame_count = 6  # Batch 6 frames per packet (~100ms interval)
    frames_bytes = bytearray()
    now_ms = int(time.time() * 1000)
    
    time_elapsed = time.time() - start_time
    
    for i in range(frame_count):
        # 1. Get Simulated Human Inputs
        in_x, in_y, tg_pitch, tg_yaw, jump = generate_smooth_inputs(time_elapsed + (i * DELTA_S))
        
        # 2. Process Physics (UE CharacterMovementComponent approximation)
        # Ground friction and acceleration
        if pos_z <= 0.0:  # On Ground
            pos_z = 0.0
            vel_z = 0.0
            
            # Apply Friction
            vel_x -= vel_x * FRICTION * DELTA_S
            vel_y -= vel_y * FRICTION * DELTA_S
            
            # Apply Acceleration
            vel_x += in_x * ACCELERATION * DELTA_S
            vel_y += in_y * ACCELERATION * DELTA_S
            
            # Clamp to Max Speed
            speed = math.sqrt(vel_x**2 + vel_y**2)
            if speed > MAX_WALK_SPEED:
                vel_x = (vel_x / speed) * MAX_WALK_SPEED
                vel_y = (vel_y / speed) * MAX_WALK_SPEED
                
            # Handle Jump
            if jump:
                vel_z = JUMP_Z_VELOCITY
        else:
            # In Air (Apply Gravity)
            vel_z += GRAVITY * DELTA_S
            
        # 3. Update Position
        pos_x += vel_x * DELTA_S
        pos_y += vel_y * DELTA_S
        pos_z += vel_z * DELTA_S
        
        # 4. Smooth Camera Interpolation
        pitch += (tg_pitch - pitch) * 10.0 * DELTA_S
        yaw += (tg_yaw - yaw) * 10.0 * DELTA_S
        
        # Packing: 6 floats, 1 uint64, 2 uint32s (matches C++ #pragma pack alignment exactly)
        frame_data = struct.pack('<ffffffQII', 
            pos_x, pos_y, pos_z, pitch, yaw, DELTA_MS, 
            now_ms - int((frame_count - i) * DELTA_MS), 
            1, 0 # input_flags, reserved
        )
        frames_bytes.extend(frame_data)
        
    nonce = int.from_bytes(os.urandom(4), 'little')
    
    # Pack header (excluding the 32-byte HMAC prefix)
    header_no_hmac = struct.pack('<QQQII', client_id, sequence_id, now_ms, nonce, frame_count)
    payload_to_hash = header_no_hmac + frames_bytes
    
    # Sign payload to pass edge security validation
    signature = hmac.new(SECRET_KEY, payload_to_hash, hashlib.sha256).digest()
    
    # Final Payload Assembly
    final_payload = signature + payload_to_hash
    
    print(f"[Synthetic UE Data] Pushed Packet Seq {sequence_id} | Pos: ({int(pos_x)}, {int(pos_y)}, {int(pos_z)})")
    sock.sendto(final_payload, (UDP_IP, UDP_PORT))
    
    sequence_id += 1
    
    # Wait ~100ms before sending the next batch to perfectly match 60fps pacing
    time.sleep(0.1)
