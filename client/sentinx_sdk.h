#ifndef SENTINX_SDK_H
#define SENTINX_SDK_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Ensure structs are packed and memory-aligned for cross-platform binary compatibility
#pragma pack(push, 1)

typedef struct {
    float pos_x;
    float pos_y;
    float pos_z;
    float pitch;
    float yaw;
    float frame_delta_ms;
    uint64_t timestamp_ms;
    uint32_t input_flags;
    uint32_t reserved; // Padding to strictly enforce 8-byte alignment natively across boundaries
} SentinxTelemetryFrame;

#pragma pack(pop)

// Opaque context pointer
typedef struct SentinxContext SentinxContext;

// Initialization
// secret_key must be exactly 32 bytes for HMAC-SHA256
// client_id_hash is a unique uint64_t identifying the connected client
// server_ip and server_port configure the Go Edge Ingestion Node
SentinxContext* sentinx_init(const uint8_t* secret_key, uint64_t client_id_hash, const char* server_ip, uint16_t server_port);

// Push a single telemetry frame to the internal static ring buffer
// Returns 0 on success, -1 if buffer is full (fail-open mode)
int sentinx_push_telemetry(SentinxContext* ctx, const SentinxTelemetryFrame* frame);

// Start the autonomous UDP background thread that reads from the ring buffer 
// and blasts AES-256 encrypted packets to the server at 60Hz.
// Returns 0 on success, non-zero on failure.
int sentinx_start_network_thread(SentinxContext* ctx);

// Stop the networking thread cleanly
void sentinx_stop_network_thread(SentinxContext* ctx);

// Cleanup
void sentinx_destroy(SentinxContext* ctx);

#ifdef __cplusplus
}
#endif

#endif // SENTINX_SDK_H
