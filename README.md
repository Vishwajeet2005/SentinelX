# 🛡️ SentinX Universal: Low-Latency Anti-Cheat & Moderation Framework

**SentinX Universal** is an engine-agnostic, zero-allocation behavior detection and anti-cheat infrastructure. Designed for high-concurrency multiplayer environments (100k+ CCU), it bridges the gap between client-side physics and server-side machine learning.

## Features
- **Zero Heap Allocations:** Lock-free `std::array` ring buffers guarantee zero garbage collection spikes in Unity, and no main thread lagging in Unreal Engine.
- **Engine-Agnostic C-ABI:** Flat `extern "C"` linkage means effortless bindings for Unreal, Unity, Godot, or any custom engine.
- **Fail-Open Resiliency:** If the network drops, the SDK natively starts compressing telemetry locally. It will *never* crash or freeze the game.
- **Forward Linear Prediction:** The Go edge server automatically heals dropped UDP packets by interpolating missing physics frames, drastically lowering false bans.

## Architecture Pipeline
1. **C++ Telemetry Client**: Packs physics data (X,Y,Z, Yaw, Pitch) into 8-byte aligned raw structs.
2. **Go Ingestion Edge**: Handles 100k+ UDP packets via concurrent worker pools. Sorts jitter and interpolates missing frames.
3. **Kafka & ClickHouse**: High-throughput message brokering and persistent time-series analytics.
4. **Python ONNX Inference**: A machine learning runtime constantly scoring player metrics for aimbot/speedhack likelihood.
5. **React Dashboard**: Live WebSocket-driven moderation interface for real-time ban control.

## Running Locally
```bash
docker-compose up -d --build
```
Navigate to `http://localhost:3000` to view the live dashboard.
