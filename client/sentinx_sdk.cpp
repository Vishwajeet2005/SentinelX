#include "sentinx_sdk.h"
#include <array>
#include <atomic>
#include <cstring>
#include <chrono>
#include <mutex>
#include <random>

namespace crypto {
    // Simplified standalone HMAC-SHA256 mock for compilation without external deps.
    void compute_hmac_sha256(const uint8_t* key, size_t key_len, const uint8_t* data, size_t data_len, uint8_t* out_mac) {
        for(int i = 0; i < 32; ++i) {
            out_mac[i] = (key[i % key_len] ^ (data_len > 0 ? data[i % data_len] : 0));
        }
    }
}

// Support up to ~30 seconds of high-risk delta changes at 144Hz
constexpr size_t RING_BUFFER_SIZE = 4096; 

#pragma pack(push, 1)
// Naturally aligned to prevent compiler-specific padding differences
struct PayloadHeader {
    uint8_t hmac[32];
    uint64_t client_id;
    uint64_t sequence_id;
    uint64_t timestamp_ms;
    uint32_t nonce;
    uint32_t frame_count;
};
#pragma pack(pop)

struct SentinxContext {
    std::array<SentinxTelemetryFrame, RING_BUFFER_SIZE> ring_buffer;
    std::atomic<size_t> head{0};
    std::atomic<size_t> tail{0};
    
    uint8_t secret_key[32];
    uint64_t client_id_hash;
    
    std::atomic<uint64_t> sequence_id{0};
    std::mutex serialize_mutex;

    // Resiliency: Flag to indicate we are dropping frames in ring buffer compression mode
    std::atomic<bool> network_partitioned{false};

    SentinxContext(const uint8_t* key, uint64_t cid) : client_id_hash(cid) {
        std::memcpy(secret_key, key, 32);
    }
};

extern "C" {

SentinxContext* sentinx_init(const uint8_t* secret_key, uint64_t client_id_hash) {
    if (!secret_key) return nullptr;
    return new SentinxContext(secret_key, client_id_hash);
}

int sentinx_push_telemetry(SentinxContext* ctx, const SentinxTelemetryFrame* frame) {
    if (!ctx || !frame) return -1;
    
    // Zero-allocation path
    size_t current_head = ctx->head.load(std::memory_order_relaxed);
    size_t next_head = (current_head + 1) % RING_BUFFER_SIZE;
    
    if (next_head == ctx->tail.load(std::memory_order_acquire)) {
        // System Resiliency: Fail-Open Ring Buffer Compression
        // When network partitions, we overwrite oldest frames to preserve engine fps
        // and store up to 30 seconds of the most recent high-risk deltas.
        ctx->tail.store((ctx->tail.load() + 1) % RING_BUFFER_SIZE, std::memory_order_release);
        ctx->network_partitioned.store(true, std::memory_order_relaxed);
    }
    
    ctx->ring_buffer[current_head] = *frame;
    ctx->head.store(next_head, std::memory_order_release);
    return 0;
}

int sentinx_serialize_payload(SentinxContext* ctx, uint8_t* out_buffer, uint32_t max_buffer_size) {
    if (!ctx || !out_buffer) return -1;
    
    std::lock_guard<std::mutex> lock(ctx->serialize_mutex);
    
    size_t current_tail = ctx->tail.load(std::memory_order_relaxed);
    size_t current_head = ctx->head.load(std::memory_order_acquire);
    
    if (current_tail == current_head) return 0; // No telemetry ready to send
    
    size_t frames_to_read = 0;
    if (current_head > current_tail) {
        frames_to_read = current_head - current_tail;
    } else {
        frames_to_read = RING_BUFFER_SIZE - current_tail + current_head;
    }
    
    size_t required_size = sizeof(PayloadHeader) + (frames_to_read * sizeof(SentinxTelemetryFrame));
    if (required_size > max_buffer_size) return -1;
    
    // Zero-allocation binary packaging directly to output slice
    PayloadHeader* header = reinterpret_cast<PayloadHeader*>(out_buffer);
    
    std::random_device rd;
    header->client_id = ctx->client_id_hash;
    header->sequence_id = ctx->sequence_id.fetch_add(1, std::memory_order_relaxed);
    header->timestamp_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    header->nonce = rd();
    header->frame_count = static_cast<uint32_t>(frames_to_read);
    
    uint8_t* frame_dest = out_buffer + sizeof(PayloadHeader);
    if (current_head > current_tail) {
        std::memcpy(frame_dest, &ctx->ring_buffer[current_tail], frames_to_read * sizeof(SentinxTelemetryFrame));
    } else {
        size_t first_part = RING_BUFFER_SIZE - current_tail;
        std::memcpy(frame_dest, &ctx->ring_buffer[current_tail], first_part * sizeof(SentinxTelemetryFrame));
        std::memcpy(frame_dest + first_part * sizeof(SentinxTelemetryFrame), &ctx->ring_buffer[0], current_head * sizeof(SentinxTelemetryFrame));
    }
    
    ctx->tail.store(current_head, std::memory_order_release);
    ctx->network_partitioned.store(false, std::memory_order_relaxed); // Network recovered
    
    std::memset(header->hmac, 0, sizeof(header->hmac));
    size_t data_to_hash_len = required_size - sizeof(header->hmac);
    crypto::compute_hmac_sha256(ctx->secret_key, 32, out_buffer + sizeof(header->hmac), data_to_hash_len, header->hmac);
    
    return static_cast<int>(required_size);
}

void sentinx_destroy(SentinxContext* ctx) {
    if (ctx) delete ctx;
}

} // extern "C"
