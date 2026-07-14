#include "sentinx_sdk.h"
#include <iostream>
#include <thread>
#include <chrono>

int main() {
    std::cout << "[Mock Unreal Engine] Initializing SentinX SDK..." << std::endl;
    
    uint8_t mock_session_key[32] = {0}; // All zeros for testing
    uint64_t client_id = 123456789;
    
    // Initialize SDK with localhost Go Edge Server
    SentinxContext* ctx = sentinx_init(mock_session_key, client_id, "127.0.0.1", 8080);
    if (!ctx) {
        std::cerr << "Failed to init SDK." << std::endl;
        return 1;
    }

    // Start background network thread
    sentinx_start_network_thread(ctx);
    
    std::cout << "[Mock Unreal Engine] SDK Autonomous Thread Started. Simulating Game Loop..." << std::endl;

    for (int i = 0; i < 60; ++i) { // Simulate 1 second of 60 FPS gameplay
        SentinxTelemetryFrame frame = {0};
        frame.pos_x = 100.0f + i;
        frame.pos_y = 200.0f + i;
        frame.pos_z = 300.0f;
        frame.pitch = 0.0f;
        frame.yaw = 90.0f;
        frame.frame_delta_ms = 16.6f;
        frame.timestamp_ms = i * 16;
        frame.input_flags = 0;
        
        sentinx_push_telemetry(ctx, &frame);
        
        std::this_thread::sleep_for(std::chrono::milliseconds(16)); // ~60fps
    }

    std::cout << "[Mock Unreal Engine] Simulation complete. Tearing down SDK..." << std::endl;
    
    sentinx_destroy(ctx);
    
    std::cout << "[Mock Unreal Engine] Teardown complete. Exiting cleanly." << std::endl;
    return 0;
}
