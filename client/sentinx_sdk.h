#ifndef SENTINX_SDK_H
#define SENTINX_SDK_H

#include <stdint.h>

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
SentinxContext* sentinx_init(const uint8_t* secret_key, uint64_t client_id_hash);

// Push a single telemetry frame to the internal static ring buffer
// Returns 0 on success, -1 if buffer is full (fail-open mode)
int sentinx_push_telemetry(SentinxContext* ctx, const SentinxTelemetryFrame* frame);

// Serialize the pending telemetry payload into the provided pre-allocated byte buffer
// The payload will contain the HMAC-SHA256 signature, rolling nonce, seq ID, timestamp, and frame data.
// out_buffer must be large enough to hold the serialized data.
// Returns the number of bytes written, or -1 on error
int sentinx_serialize_payload(SentinxContext* ctx, uint8_t* out_buffer, uint32_t max_buffer_size);

// Cleanup
void sentinx_destroy(SentinxContext* ctx);

#ifdef __cplusplus
}
#endif

#endif // SENTINX_SDK_H
