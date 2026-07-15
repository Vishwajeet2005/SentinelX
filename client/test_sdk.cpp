#include "sentinx_sdk.h"
#include <iostream>
#include <cassert>
#include <cstring>

void test_ring_buffer_fail_open() {
    std::cout << "[Test] Starting test_ring_buffer_fail_open..." << std::endl;
    
    uint8_t dummy_key[32] = {0};
    SentinxContext* ctx = sentinx_init(dummy_key, 111, "127.0.0.1", 8080);
    assert(ctx != nullptr);

    // Fill the buffer to the brim (RING_BUFFER_SIZE is 4096)
    for (int i = 0; i < 4096; ++i) {
        SentinxTelemetryFrame f = {0};
        f.pos_x = (float)i;
        assert(sentinx_push_telemetry(ctx, &f) == 0);
    }

    // Push one more to trigger fail-open (network partitioned) overwrite
    SentinxTelemetryFrame overflow = {0};
    overflow.pos_x = 9999.0f;
    assert(sentinx_push_telemetry(ctx, &overflow) == 0);

    sentinx_destroy(ctx);
    std::cout << "[Test] test_ring_buffer_fail_open PASSED." << std::endl;
}

int main() {
    test_ring_buffer_fail_open();
    std::cout << "All C++ SDK tests passed successfully!" << std::endl;
    return 0;
}
