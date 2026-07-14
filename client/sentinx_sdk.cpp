#include "sentinx_sdk.h"
#include <array>
#include <atomic>
#include <cstring>
#include <chrono>
#include <mutex>
#include <random>
#include <thread>
#include <iostream>
#include <string>

// OpenSSL
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>
#include <openssl/sha.h>

// Cross-Platform Sockets
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "Ws2_32.lib")
    typedef int socklen_t;
#else
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    typedef int SOCKET;
    #define INVALID_SOCKET -1
    #define SOCKET_ERROR -1
    #define closesocket close
#endif

constexpr size_t RING_BUFFER_SIZE = 4096; 
constexpr int TARGET_FPS = 60;
constexpr int SLEEP_MS = 1000 / TARGET_FPS;

#pragma pack(push, 1)
struct PayloadHeader {
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
    uint8_t aes_key[32];
    uint64_t client_id_hash;
    
    std::string server_ip;
    uint16_t server_port;

    std::atomic<uint64_t> sequence_id{0};
    std::atomic<bool> network_partitioned{false};
    
    // Networking Thread
    std::thread net_thread;
    std::atomic<bool> thread_running{false};

    SentinxContext(const uint8_t* key, uint64_t cid, const char* ip, uint16_t port) 
        : client_id_hash(cid), server_ip(ip), server_port(port) {
        std::memcpy(secret_key, key, 32);
        
        // Derive AES key via SHA-256(SessionKey)
        SHA256(secret_key, 32, aes_key);
        
        #ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
        #endif
    }

    ~SentinxContext() {
        #ifdef _WIN32
        WSACleanup();
        #endif
    }
};

static void network_worker(SentinxContext* ctx) {
    SOCKET sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock == INVALID_SOCKET) {
        return;
    }

    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(ctx->server_port);
    inet_pton(AF_INET, ctx->server_ip.c_str(), &server_addr.sin_addr);

    // Pre-allocate a large buffer for building the packet
    // Max packet: 8 (ClientID) + 32 (HMAC) + 12 (IV) + Plaintext + 16 (Tag)
    const size_t MAX_PACKET_SIZE = 65536;
    uint8_t* packet_buffer = new uint8_t[MAX_PACKET_SIZE];
    uint8_t* plaintext_buffer = new uint8_t[MAX_PACKET_SIZE];

    while (ctx->thread_running.load(std::memory_order_relaxed)) {
        std::this_thread::sleep_for(std::chrono::milliseconds(SLEEP_MS));

        size_t current_tail = ctx->tail.load(std::memory_order_relaxed);
        size_t current_head = ctx->head.load(std::memory_order_acquire);
        
        if (current_tail == current_head) continue; // No new frames
        
        size_t frames_to_read = (current_head >= current_tail) ? (current_head - current_tail) : (RING_BUFFER_SIZE - current_tail + current_head);
        
        // --- 1. Assemble Plaintext (Header + Frames) ---
        PayloadHeader* header = reinterpret_cast<PayloadHeader*>(plaintext_buffer);
        header->client_id = ctx->client_id_hash;
        header->sequence_id = ctx->sequence_id.fetch_add(1, std::memory_order_relaxed);
        header->timestamp_ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
        RAND_bytes(reinterpret_cast<unsigned char*>(&header->nonce), sizeof(uint32_t));
        header->frame_count = static_cast<uint32_t>(frames_to_read);
        
        uint8_t* frame_dest = plaintext_buffer + sizeof(PayloadHeader);
        if (current_head > current_tail) {
            std::memcpy(frame_dest, &ctx->ring_buffer[current_tail], frames_to_read * sizeof(SentinxTelemetryFrame));
        } else {
            size_t first_part = RING_BUFFER_SIZE - current_tail;
            std::memcpy(frame_dest, &ctx->ring_buffer[current_tail], first_part * sizeof(SentinxTelemetryFrame));
            std::memcpy(frame_dest + first_part * sizeof(SentinxTelemetryFrame), &ctx->ring_buffer[0], current_head * sizeof(SentinxTelemetryFrame));
        }
        ctx->tail.store(current_head, std::memory_order_release);
        
        int plaintext_len = sizeof(PayloadHeader) + (frames_to_read * sizeof(SentinxTelemetryFrame));

        // --- 2. Build Packet Skeleton ---
        // 0-8: ClientID
        std::memcpy(packet_buffer, &ctx->client_id_hash, 8);
        
        // 8-40: HMAC (Reserved for later)
        std::memset(packet_buffer + 8, 0, 32);

        // 40-52: IV
        uint8_t* iv = packet_buffer + 40;
        RAND_bytes(iv, 12);

        // --- 3. AES-256-GCM Encryption ---
        uint8_t* ciphertext = packet_buffer + 52;
        EVP_CIPHER_CTX* evp_ctx = EVP_CIPHER_CTX_new();
        EVP_EncryptInit_ex(evp_ctx, EVP_aes_256_gcm(), NULL, NULL, NULL);
        EVP_CIPHER_CTX_ctrl(evp_ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL);
        EVP_EncryptInit_ex(evp_ctx, NULL, NULL, ctx->aes_key, iv);
        
        int len;
        int ciphertext_len = 0;
        EVP_EncryptUpdate(evp_ctx, ciphertext, &len, plaintext_buffer, plaintext_len);
        ciphertext_len = len;
        EVP_EncryptFinal_ex(evp_ctx, ciphertext + len, &len);
        ciphertext_len += len;
        
        // Get 16-byte GCM Tag and append to ciphertext
        uint8_t* tag = ciphertext + ciphertext_len;
        EVP_CIPHER_CTX_ctrl(evp_ctx, EVP_CTRL_GCM_GET_TAG, 16, tag);
        EVP_CIPHER_CTX_free(evp_ctx);

        int total_packet_len = 52 + ciphertext_len + 16;

        // --- 4. HMAC-SHA256 Signing ---
        // Go expects HMAC covering ClientID(8) + IV+Ciphertext+Tag
        uint8_t* mac_target = packet_buffer + 8;
        unsigned int mac_len;
        
        // Copy ClientID and Encrypted portion to temporary buffer for hashing
        int hash_input_len = 8 + (total_packet_len - 40);
        uint8_t* hash_input = new uint8_t[hash_input_len];
        std::memcpy(hash_input, packet_buffer, 8); // ClientID
        std::memcpy(hash_input + 8, packet_buffer + 40, total_packet_len - 40); // IV+Ctx+Tag
        
        HMAC(EVP_sha256(), ctx->secret_key, 32, hash_input, hash_input_len, mac_target, &mac_len);
        delete[] hash_input;

        // --- 5. Fire and Forget UDP Transmission ---
        sendto(sock, reinterpret_cast<const char*>(packet_buffer), total_packet_len, 0, (sockaddr*)&server_addr, sizeof(server_addr));
    }

    delete[] packet_buffer;
    delete[] plaintext_buffer;
    closesocket(sock);
}

extern "C" {

SentinxContext* sentinx_init(const uint8_t* secret_key, uint64_t client_id_hash, const char* server_ip, uint16_t server_port) {
    if (!secret_key || !server_ip) return nullptr;
    return new SentinxContext(secret_key, client_id_hash, server_ip, server_port);
}

int sentinx_push_telemetry(SentinxContext* ctx, const SentinxTelemetryFrame* frame) {
    if (!ctx || !frame) return -1;
    
    size_t current_head = ctx->head.load(std::memory_order_relaxed);
    size_t next_head = (current_head + 1) % RING_BUFFER_SIZE;
    
    if (next_head == ctx->tail.load(std::memory_order_acquire)) {
        ctx->tail.store((ctx->tail.load() + 1) % RING_BUFFER_SIZE, std::memory_order_release);
        ctx->network_partitioned.store(true, std::memory_order_relaxed);
    }
    
    ctx->ring_buffer[current_head] = *frame;
    ctx->head.store(next_head, std::memory_order_release);
    return 0;
}

int sentinx_start_network_thread(SentinxContext* ctx) {
    if (!ctx) return -1;
    if (ctx->thread_running.load()) return 0; // Already running
    
    ctx->thread_running.store(true);
    ctx->net_thread = std::thread(network_worker, ctx);
    return 0;
}

void sentinx_stop_network_thread(SentinxContext* ctx) {
    if (!ctx) return;
    if (ctx->thread_running.load()) {
        ctx->thread_running.store(false);
        if (ctx->net_thread.joinable()) {
            ctx->net_thread.join();
        }
    }
}

void sentinx_destroy(SentinxContext* ctx) {
    if (ctx) {
        sentinx_stop_network_thread(ctx);
        delete ctx;
    }
}

} // extern "C"
