"""
SentinelX — Day 1: Synthetic Telemetry Data Generator
======================================================
Generates labeled player movement data and inserts it into ClickHouse.

Two classes:
  0 = NORMAL  — realistic human player physics
  1 = CHEAT   — speedhack, aimbot, or teleport patterns

Output: ClickHouse table `sentinx.telemetry_sequences`
Each row = one 60-frame sequence (flattened) + label

Usage:
    python generate_data.py --normal 50000 --cheat 15000
    python generate_data.py --normal 50000 --cheat 15000 --csv-only
"""

import argparse
import numpy as np
import pandas as pd
import os
from datetime import datetime

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────
SEQUENCE_LENGTH = 60        # frames per sequence (1 second at 60 tick)
FEATURES = 6                # PosX, PosY, PosZ, Pitch, Yaw, FrameDeltaMS
TARGET_FPS = 60             # server tick rate
BASE_FRAME_MS = 1000.0 / TARGET_FPS  # ~16.67ms

# Movement constraints (Unreal Engine units, 1 UU ≈ 1cm)
MAX_WALK_SPEED = 600        # UU/s → ~10 UU/frame at 60fps
MAX_SPRINT_SPEED = 900      # UU/s → ~15 UU/frame
MAX_CROUCH_SPEED = 300      # UU/s → ~5 UU/frame
GRAVITY = -9.8 * 100        # -980 UU/s² (approx Unreal default)
JUMP_VELOCITY = 420         # UU/s initial vertical

# Aim constraints (degrees)
MAX_PITCH = 80.0            # degrees (clamped)
MIN_PITCH = -80.0
MAX_YAW_DELTA_PER_FRAME = 8.0   # max human mouse speed per frame
MAX_PITCH_DELTA_PER_FRAME = 5.0

# ──────────────────────────────────────────────
# NORMAL PLAYER SIMULATOR
# ──────────────────────────────────────────────

def simulate_normal_sequence(rng: np.random.Generator) -> np.ndarray:
    """
    Simulates one 60-frame sequence of a normal human player.
    Includes: walking, strafing, occasional jumps, natural aim drift.
    Returns shape (60, 6)
    """
    seq = np.zeros((SEQUENCE_LENGTH, FEATURES), dtype=np.float32)

    # Random starting position (map bounds ~50k UU)
    pos = rng.uniform(-25000, 25000, size=3).astype(np.float32)
    pos[2] = rng.uniform(0, 200)    # Z: ground level ± small variation

    # Random starting aim
    pitch = rng.uniform(-30, 30)
    yaw = rng.uniform(-180, 180)

    # Choose movement mode for this sequence
    mode = rng.choice(['walk', 'sprint', 'crouch', 'idle'], p=[0.5, 0.25, 0.15, 0.1])
    speed_map = {'walk': MAX_WALK_SPEED, 'sprint': MAX_SPRINT_SPEED,
                 'crouch': MAX_CROUCH_SPEED, 'idle': 0}
    speed = speed_map[mode]

    # Random movement direction (can change slightly each frame)
    move_dir = rng.uniform(-1, 1, size=2)
    norm = np.linalg.norm(move_dir)
    if norm > 0:
        move_dir /= norm

    # Jump state
    vel_z = 0.0
    on_ground = True
    jump_chance = 0.03  # 3% chance to jump per frame

    for i in range(SEQUENCE_LENGTH):
        # ── Frame timing: realistic jitter ──
        frame_ms = BASE_FRAME_MS + rng.normal(0, 0.4)
        frame_ms = np.clip(frame_ms, 10.0, 30.0)
        dt = frame_ms / 1000.0

        # ── Horizontal movement with slight direction drift ──
        drift = rng.normal(0, 0.05, size=2)
        move_dir = move_dir + drift
        norm = np.linalg.norm(move_dir)
        if norm > 0:
            move_dir /= norm

        # Idle players barely move
        effective_speed = speed if mode != 'idle' else rng.uniform(0, 30)

        pos[0] += move_dir[0] * effective_speed * dt
        pos[1] += move_dir[1] * effective_speed * dt

        # ── Vertical movement (gravity + jump) ──
        if on_ground and rng.random() < jump_chance:
            vel_z = JUMP_VELOCITY
            on_ground = False

        if not on_ground:
            vel_z += GRAVITY * dt
            pos[2] += vel_z * dt
            if pos[2] <= 0:
                pos[2] = 0.0
                vel_z = 0.0
                on_ground = True

        # ── Aim movement: human mouse has natural curves + micro-tremor ──
        # Smooth continuous aim with occasional flicks
        aim_intent_yaw = rng.normal(0, 1.5)       # base tracking
        aim_intent_pitch = rng.normal(0, 0.8)

        # Occasional small flick (fast aim correction)
        if rng.random() < 0.05:
            aim_intent_yaw += rng.normal(0, 3.0)
            aim_intent_pitch += rng.normal(0, 2.0)

        # Clamp to human-achievable per-frame delta
        d_yaw = np.clip(aim_intent_yaw, -MAX_YAW_DELTA_PER_FRAME,
                        MAX_YAW_DELTA_PER_FRAME)
        d_pitch = np.clip(aim_intent_pitch, -MAX_PITCH_DELTA_PER_FRAME,
                          MAX_PITCH_DELTA_PER_FRAME)

        # ML HYGIENE: Continuous Yaw (no modulo 360 wrap-around)
        yaw = yaw + d_yaw
        pitch = np.clip(pitch + d_pitch, MIN_PITCH, MAX_PITCH)

        seq[i] = [pos[0], pos[1], pos[2], pitch, yaw, frame_ms]

    return seq


# ──────────────────────────────────────────────
# CHEAT SIMULATORS
# ──────────────────────────────────────────────

def simulate_speedhack_sequence(rng: np.random.Generator) -> np.ndarray:
    """
    Speedhack: position deltas massively exceed physical max speed.
    Player moves 3-8x faster than legitimate sprint speed.
    """
    seq = np.zeros((SEQUENCE_LENGTH, FEATURES), dtype=np.float32)

    pos = rng.uniform(-25000, 25000, size=3).astype(np.float32)
    pos[2] = 0.0
    pitch = rng.uniform(-30, 30)
    yaw = rng.uniform(-180, 180)

    # Speed multiplier: 3x to 8x normal sprint
    hack_speed = MAX_SPRINT_SPEED * rng.uniform(3.0, 8.0)
    move_dir = rng.uniform(-1, 1, size=2)
    norm = np.linalg.norm(move_dir)
    if norm > 0:
        move_dir /= norm

    for i in range(SEQUENCE_LENGTH):
        # Frame timing looks normal (cheater tries to hide)
        frame_ms = BASE_FRAME_MS + rng.normal(0, 0.5)
        frame_ms = np.clip(frame_ms, 12.0, 25.0)
        dt = frame_ms / 1000.0

        # Massively fast movement
        pos[0] += move_dir[0] * hack_speed * dt
        pos[1] += move_dir[1] * hack_speed * dt

        # Aim looks normal — speedhack doesn't affect aim
        d_yaw = np.clip(rng.normal(0, 1.5), -MAX_YAW_DELTA_PER_FRAME,
                        MAX_YAW_DELTA_PER_FRAME)
        d_pitch = np.clip(rng.normal(0, 0.8), -MAX_PITCH_DELTA_PER_FRAME,
                          MAX_PITCH_DELTA_PER_FRAME)
        yaw = yaw + d_yaw
        pitch = np.clip(pitch + d_pitch, MIN_PITCH, MAX_PITCH)

        seq[i] = [pos[0], pos[1], pos[2], pitch, yaw, frame_ms]

    return seq


def simulate_aimbot_sequence(rng: np.random.Generator) -> np.ndarray:
    """
    Aimbot: inhuman aim snapping. Yaw/Pitch lock to exact target angles
    with near-zero variance. No natural tremor. Instantaneous corrections.
    """
    seq = np.zeros((SEQUENCE_LENGTH, FEATURES), dtype=np.float32)

    pos = rng.uniform(-25000, 25000, size=3).astype(np.float32)
    pos[2] = 0.0
    pitch = rng.uniform(-30, 30)
    yaw = rng.uniform(-180, 180)

    move_dir = rng.uniform(-1, 1, size=2)
    norm = np.linalg.norm(move_dir)
    if norm > 0:
        move_dir /= norm

    # Aimbot locks to a "target" angle and snaps there every N frames
    target_yaw = rng.uniform(-180, 180)
    target_pitch = rng.uniform(-30, 30)
    snap_interval = rng.integers(3, 10)  # snaps every 3-10 frames

    for i in range(SEQUENCE_LENGTH):
        frame_ms = BASE_FRAME_MS + rng.normal(0, 0.3)
        frame_ms = np.clip(frame_ms, 12.0, 25.0)
        dt = frame_ms / 1000.0

        # Normal movement
        pos[0] += move_dir[0] * MAX_WALK_SPEED * dt
        pos[1] += move_dir[1] * MAX_WALK_SPEED * dt

        # Snap to new target every N frames — zero natural curve
        if i % snap_interval == 0:
            target_yaw = rng.uniform(-180, 180)
            target_pitch = rng.uniform(-30, 30)
            yaw = target_yaw   # instant snap — no interpolation
            pitch = target_pitch
        else:
            # Micro-correction with near-zero variance (inhuman precision)
            yaw += rng.normal(0, 0.05)     # human has ~1.5 std dev, aimbot has 0.05
            pitch += rng.normal(0, 0.03)

        pitch = np.clip(pitch, MIN_PITCH, MAX_PITCH)
        seq[i] = [pos[0], pos[1], pos[2], pitch, yaw, frame_ms]

    return seq


def simulate_teleport_sequence(rng: np.random.Generator) -> np.ndarray:
    """
    Teleport/position injection: position jumps discontinuously across
    thousands of UU in a single frame. Physically impossible.
    """
    seq = np.zeros((SEQUENCE_LENGTH, FEATURES), dtype=np.float32)

    pos = rng.uniform(-25000, 25000, size=3).astype(np.float32)
    pos[2] = 0.0
    pitch = rng.uniform(-30, 30)
    yaw = rng.uniform(-180, 180)

    move_dir = rng.uniform(-1, 1, size=2)
    norm = np.linalg.norm(move_dir)
    if norm > 0:
        move_dir /= norm

    # 1-3 teleport events per sequence
    teleport_frames = sorted(rng.choice(range(5, 55), size=rng.integers(1, 4),
                                         replace=False))

    for i in range(SEQUENCE_LENGTH):
        frame_ms = BASE_FRAME_MS + rng.normal(0, 0.4)
        frame_ms = np.clip(frame_ms, 12.0, 25.0)
        dt = frame_ms / 1000.0

        if i in teleport_frames:
            # Teleport: jump to completely different location
            pos[0] = rng.uniform(-25000, 25000)
            pos[1] = rng.uniform(-25000, 25000)
        else:
            pos[0] += move_dir[0] * MAX_WALK_SPEED * dt
            pos[1] += move_dir[1] * MAX_WALK_SPEED * dt

        d_yaw = np.clip(rng.normal(0, 1.5), -MAX_YAW_DELTA_PER_FRAME,
                        MAX_YAW_DELTA_PER_FRAME)
        d_pitch = np.clip(rng.normal(0, 0.8), -MAX_PITCH_DELTA_PER_FRAME,
                          MAX_PITCH_DELTA_PER_FRAME)
        yaw = yaw + d_yaw
        pitch = np.clip(pitch + d_pitch, MIN_PITCH, MAX_PITCH)

        seq[i] = [pos[0], pos[1], pos[2], pitch, yaw, frame_ms]

    return seq


def simulate_cheat_sequence(rng: np.random.Generator) -> np.ndarray:
    """Randomly pick a cheat type."""
    cheat_fn = rng.choice([
        simulate_speedhack_sequence,
        simulate_aimbot_sequence,
        simulate_teleport_sequence
    ])
    return cheat_fn(rng)


# ──────────────────────────────────────────────
# DATASET BUILDER
# ──────────────────────────────────────────────

def build_dataset(n_normal: int, n_cheat: int,
                  seed: int = 42) -> pd.DataFrame:
    """
    Generates the full dataset.
    """
    rng = np.random.default_rng(seed)

    print(f"Generating {n_normal:,} normal sequences...")
    normal_seqs = np.array([simulate_normal_sequence(rng)
                            for _ in range(n_normal)], dtype=np.float32)

    print(f"Generating {n_cheat:,} cheat sequences...")
    cheat_types_list = []
    cheat_seqs = []
    cheat_type_fns = [simulate_speedhack_sequence,
                      simulate_aimbot_sequence,
                      simulate_teleport_sequence]
    cheat_type_names = ['speedhack', 'aimbot', 'teleport']

    for _ in range(n_cheat):
        idx = rng.integers(0, 3)
        seq = cheat_type_fns[idx](rng)
        cheat_seqs.append(seq)
        cheat_types_list.append(cheat_type_names[idx])

    cheat_seqs = np.array(cheat_seqs, dtype=np.float32)

    # Build feature column names
    feat_names = ['PosX', 'PosY', 'PosZ', 'Pitch', 'Yaw', 'FrameDeltaMS']
    columns = [f'{feat}_f{i}' for i in range(SEQUENCE_LENGTH)
               for feat in feat_names]

    # Flatten sequences: (N, 60, 6) → (N, 360)
    normal_flat = normal_seqs.reshape(n_normal, -1)
    cheat_flat = cheat_seqs.reshape(n_cheat, -1)

    df_normal = pd.DataFrame(normal_flat, columns=columns)
    df_normal['label'] = 0
    df_normal['cheat_type'] = 'none'

    df_cheat = pd.DataFrame(cheat_flat, columns=columns)
    df_cheat['label'] = 1
    df_cheat['cheat_type'] = cheat_types_list

    df = pd.concat([df_normal, df_cheat], ignore_index=True)

    # Shuffle
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    df['sequence_id'] = [f"seq_{i:07d}" for i in range(len(df))]
    df['generated_at'] = datetime.utcnow().isoformat()

    print(f"Dataset ready: {len(df):,} sequences "
          f"({n_normal:,} normal / {n_cheat:,} cheat)")
    print(f"Class balance: "
          f"{n_normal/(n_normal+n_cheat)*100:.1f}% normal, "
          f"{n_cheat/(n_normal+n_cheat)*100:.1f}% cheat")
    print(f"Cheat breakdown: "
          f"{cheat_types_list.count('speedhack')} speedhack, "
          f"{cheat_types_list.count('aimbot')} aimbot, "
          f"{cheat_types_list.count('teleport')} teleport")

    return df


# ──────────────────────────────────────────────
# CLICKHOUSE WRITER
# ──────────────────────────────────────────────

def write_to_clickhouse(df: pd.DataFrame, host: str = 'localhost',
                        port: int = 9000, database: str = 'sentinx') -> None:
    """
    Creates the telemetry_sequences table if it doesn't exist,
    then bulk-inserts the dataset.
    """
    try:
        from clickhouse_driver import Client
    except ImportError:
        print("clickhouse-driver not installed. Run: pip install clickhouse-driver")
        return

    client = Client(host=host, port=port)

    # Create database
    client.execute(f"CREATE DATABASE IF NOT EXISTS {database}")

    # Build CREATE TABLE columns
    feat_names = ['PosX', 'PosY', 'PosZ', 'Pitch', 'Yaw', 'FrameDeltaMS']
    feature_cols = '\n'.join([
        f"    {feat}_f{i} Float32,"
        for i in range(SEQUENCE_LENGTH)
        for feat in feat_names
    ])

    create_sql = f"""
    CREATE TABLE IF NOT EXISTS {database}.telemetry_sequences (
        sequence_id     String,
        generated_at    String,
        label           UInt8,
        cheat_type      String,
{feature_cols}
        PRIMARY KEY (sequence_id)
    ) ENGINE = MergeTree()
    ORDER BY sequence_id
    """

    client.execute(create_sql)
    print(f"Table {database}.telemetry_sequences ready.")

    # Insert in chunks
    CHUNK_SIZE = 5000
    total = len(df)
    inserted = 0

    # Column order for insert
    col_order = (['sequence_id', 'generated_at', 'label', 'cheat_type'] +
                 [f'{feat}_f{i}' for i in range(SEQUENCE_LENGTH)
                  for feat in feat_names])

    df_ordered = df[col_order]

    print(f"Inserting {total:,} rows into ClickHouse...")
    for start in range(0, total, CHUNK_SIZE):
        chunk = df_ordered.iloc[start:start + CHUNK_SIZE]
        data = chunk.values.tolist()
        client.execute(
            f"INSERT INTO {database}.telemetry_sequences VALUES",
            data
        )
        inserted += len(chunk)
        pct = inserted / total * 100
        print(f"  {inserted:,}/{total:,} ({pct:.0f}%)", end='\r')

    print(f"\nDone. {inserted:,} sequences inserted into ClickHouse.")

    # Quick verification
    count = client.execute(
        f"SELECT label, count() as cnt FROM {database}.telemetry_sequences "
        f"GROUP BY label ORDER BY label"
    )
    print("\nVerification:")
    for row in count:
        label_name = "NORMAL" if row[0] == 0 else "CHEAT"
        print(f"  Label {row[0]} ({label_name}): {row[1]:,} sequences")


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SentinelX synthetic telemetry data generator"
    )
    parser.add_argument('--normal', type=int, default=50000,
                        help='Number of normal sequences (default: 50000)')
    parser.add_argument('--cheat', type=int, default=15000,
                        help='Number of cheat sequences (default: 15000)')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed for reproducibility (default: 42)')
    parser.add_argument('--host', type=str, default='localhost',
                        help='ClickHouse host (default: localhost)')
    parser.add_argument('--port', type=int, default=9000,
                        help='ClickHouse port (default: 9000)')
    parser.add_argument('--database', type=str, default='sentinx',
                        help='ClickHouse database (default: sentinx)')
    parser.add_argument('--csv-only', action='store_true',
                        help='Save to CSV only, skip ClickHouse insert')
    parser.add_argument('--output', type=str, default='sentinelx_dataset.csv',
                        help='CSV output path (default: sentinelx_dataset.csv)')
    args = parser.parse_args()

    print("=" * 60)
    print("SentinelX — Synthetic Telemetry Generator")
    print("=" * 60)

    df = build_dataset(args.normal, args.cheat, args.seed)

    # Always save CSV as backup
    print(f"\nSaving CSV backup to {args.output}...")
    df.to_csv(args.output, index=False)
    print(f"CSV saved: {os.path.getsize(args.output) / 1024 / 1024:.1f} MB")

    if not args.csv_only:
        print("\nWriting to ClickHouse...")
        write_to_clickhouse(df, args.host, args.port, args.database)
    else:
        print("\nSkipping ClickHouse insert (--csv-only flag set).")

    print("\nDay 1 complete. Dataset ready for model training.")
    print("Next step: run train_model.py")
