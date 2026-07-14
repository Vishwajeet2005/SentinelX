cmake_minimum_required(VERSION 3.15)
project(SentinX_SDK VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Industry standard: strict warnings and LTO for maximum performance
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -O3")

# Enable Link Time Optimization (LTO) if supported
include(CheckIPOSupported)
check_ipo_supported(RESULT lto_supported OUTPUT error)
if(lto_supported)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
endif()

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Find OpenSSL for Cryptography
find_package(OpenSSL REQUIRED)

# Compile as a shared dynamic library
add_library(sentinx_sdk SHARED sentinx_sdk.cpp)

# Include directories
target_include_directories(sentinx_sdk PUBLIC ${OPENSSL_INCLUDE_DIR})

# Link libraries (OpenSSL + Sockets)
if(WIN32)
    target_link_libraries(sentinx_sdk PRIVATE OpenSSL::SSL OpenSSL::Crypto ws2_32)
    set_target_properties(sentinx_sdk PROPERTIES PREFIX "")
else()
    target_link_libraries(sentinx_sdk PRIVATE OpenSSL::SSL OpenSSL::Crypto pthread)
    if(APPLE)
        set_target_properties(sentinx_sdk PROPERTIES SUFFIX ".dylib")
    endif()
endif()
