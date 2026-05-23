import socket
import struct
import time
import random
import hashlib
import hmac

# Match C++ and Go configuration
UDP_IP = "127.0.0.1"
UDP_PORT = 8080
SECRET_KEY = b"REPLACE_WITH_SECURE_32_BYTE_KEY"

print(f"Starting Mock Game Client. Targeting UDP {UDP_IP}:{UDP_PORT}")

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

client_id = 999999
sequence_id = 1

while True:
    frame_count = 10
    frames_bytes = bytearray()
    now_ms = int(time.time() * 1000)
    
    for i in range(frame_count):
        # Simulate a blatant aimbot/speedhacker by injecting crazy rotational snapping
        pos_x = random.uniform(0.0, 1000.0)
        pos_y = random.uniform(0.0, 1000.0)
        pos_z = 0.0
        pitch = random.uniform(-90.0, 90.0)
        yaw = random.uniform(0.0, 360.0)
        delta_ms = 16.6 # 60fps pacing
        
        # Packing: 6 floats, 1 uint64, 2 uint32s (matches C++ #pragma pack alignment exactly)
        frame_data = struct.pack('<ffffffQII', 
            pos_x, pos_y, pos_z, pitch, yaw, delta_ms, 
            now_ms - (frame_count - i) * 16, 
            1, 0 # input_flags, reserved
        )
        frames_bytes.extend(frame_data)
        
    nonce = random.randint(0, 4294967295)
    
    # Pack header (excluding the 32-byte HMAC prefix)
    header_no_hmac = struct.pack('<QQQII', client_id, sequence_id, now_ms, nonce, frame_count)
    payload_to_hash = header_no_hmac + frames_bytes
    
    # Sign payload to pass edge security validation
    signature = hmac.new(SECRET_KEY, payload_to_hash, hashlib.sha256).digest()
    
    # Final Payload Assembly
    final_payload = signature + payload_to_hash
    
    print(f"[SentinX Mock Client] Shot Packet SeqID {sequence_id} ({len(final_payload)} bytes) to Edge Server")
    sock.sendto(final_payload, (UDP_IP, UDP_PORT))
    
    sequence_id += 1
    
    # Loop every ~100ms
    time.sleep(0.1)
