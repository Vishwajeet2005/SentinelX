-- ClickHouse Schema for SentinX Telemetry Analytics
-- Optimized for massive real-time ingestion via Kafka Engine and time-series analytical queries

CREATE DATABASE IF NOT EXISTS sentinx;

-- 1. Main Telemetry Table
CREATE TABLE IF NOT EXISTS sentinx.telemetry_frames
(
    client_id UInt64,
    sequence_id UInt64,
    timestamp_ms UInt64,
    pos_x Float32,
    pos_y Float32,
    pos_z Float32,
    pitch Float32,
    yaw Float32,
    frame_delta_ms Float32,
    input_flags UInt32,
    is_interpolated UInt8, 
    received_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(received_at)
ORDER BY (client_id, timestamp_ms);

-- 2. Kafka Consumer Engine Table
-- Automatically consumes and deserializes JSON from the edge ingestion pipeline
CREATE TABLE IF NOT EXISTS sentinx.kafka_telemetry_queue
(
    client_id UInt64,
    sequence_id UInt64,
    timestamp_ms UInt64,
    frames String -- Kept as Raw JSON string to unnest in MV
)
ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'localhost:9092',
    kafka_topic_list = 'sentinx_telemetry',
    kafka_group_name = 'clickhouse_ingest_group',
    kafka_format = 'JSONEachRow';

-- 3. Materialized View to pipeline Kafka data into MergeTree automatically
CREATE MATERIALIZED VIEW IF NOT EXISTS sentinx.telemetry_mv TO sentinx.telemetry_frames AS
SELECT
    client_id,
    sequence_id,
    timestamp_ms,
    JSONExtractFloat(frame, 'PosX') as pos_x,
    JSONExtractFloat(frame, 'PosY') as pos_y,
    JSONExtractFloat(frame, 'PosZ') as pos_z,
    JSONExtractFloat(frame, 'Pitch') as pitch,
    JSONExtractFloat(frame, 'Yaw') as yaw,
    JSONExtractFloat(frame, 'FrameDeltaMS') as frame_delta_ms,
    JSONExtractUInt(frame, 'InputFlags') as input_flags,
    JSONExtractUInt(frame, 'IsInterpolated') as is_interpolated,
    now() as received_at
FROM (
    SELECT 
        client_id, 
        sequence_id, 
        timestamp_ms, 
        arrayJoin(JSONExtractArrayRaw(frames)) as frame
    FROM sentinx.kafka_telemetry_queue
);
