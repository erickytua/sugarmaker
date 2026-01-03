#!/bin/bash
#
# build.sh - Build script for YespowerTidecoin WASM module
#
# This script compiles the YespowerTidecoin algorithm to WebAssembly using
# Emscripten, producing optimized .wasm and .js files.
#
# Requirements:
# - Emscripten SDK (emcc) installed and in PATH
#   See: https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./build.sh [clean]
#
#   clean  - Remove build artifacts before building
#

set -e  # Exit on error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Output directory
OUTPUT_DIR="dist"
mkdir -p "$OUTPUT_DIR"

# Compiler settings
CC="emcc"
CFLAGS="-O3 \
        -DNDEBUG \
        -I. \
        -Iinclude \
        -Iyespower-1.0.1 \
        -Iyespower-1.0.1/. \
        -fno-exceptions \
        -fno-rtti \
        -fno-threadsafe-statics"

# Emscripten settings
EMFLAGS="-s WASM=1 \
         -s ALLOW_MEMORY_GROWTH=1 \
         -s MODULARIZE=1 \
         -s EXPORT_NAME=\"YespowerTidecoin\" \
         -s EXPORTED_FUNCTIONS=\"_scan_tidecoin_hash,_compute_single_hash,_get_hashes_done,_get_algorithm_params,_get_version,_get_hash_size,_get_block_size,_malloc,_free\" \
         -s EXPORTED_RUNTIME_METHODS=\"cwrap,getValue,setValue,UTF8ToString,stringToUTF8\" \
         -s NO_FILESYSTEM=1 \
         -s ENVIRONMENT='web,node' \
         -s MINIFY=1 \
         -s AGGRESSIVE_VARIABLE_ELIMINATION=1 \
         -s DEAD_FUNCTIONS_ELIMINATION=1 \
         -s TEXTDECODER=1"

# Output files
WASM_OUTPUT="${OUTPUT_DIR}/yespower-tidecoin.wasm"
JS_OUTPUT="${OUTPUT_DIR}/yespower-tidecoin.js"

# Clean build artifacts if requested
if [ "$1" = "clean" ]; then
    echo "Cleaning build artifacts..."
    rm -rf "${OUTPUT_DIR}"
    mkdir -p "${OUTPUT_DIR}"
fi

echo "Building YespowerTidecoin WASM module..."
echo "Compiler: $CC"
echo "Output: ${WASM_OUTPUT}"
echo ""

# Source files
SOURCES="src/wasm-wrapper.c \
         src/YespowerTidecoin.c \
         src/fulltest.c \
         yespower-1.0.1/yespower-opt.c \
         yespower-1.0.1/sha256.c"

# Build command
BUILD_CMD="$CC $CFLAGS $EMFLAGS $SOURCES -o ${JS_OUTPUT}"

echo "Running: $BUILD_CMD"
echo ""

# Execute build
eval $BUILD_CMD

# Report results
if [ -f "${WASM_OUTPUT}" ]; then
    WASM_SIZE=$(stat -c%s "${WASM_OUTPUT}" 2>/dev/null || stat -f%z "${WASM_OUTPUT}" 2>/dev/null || echo "unknown")
    echo "✓ Build successful!"
    echo "✓ WASM file: ${WASM_OUTPUT} (${WASM_SIZE} bytes)"
    echo "✓ JS glue:   ${JS_OUTPUT}"
else
    echo "✗ Build failed - WASM file not generated"
    exit 1
fi

# Create a minified version (optional)
if command -v terser &> /dev/null; then
    echo ""
    echo "Minifying JavaScript glue code..."
    terser "${JS_OUTPUT}" -c -m -o "${JS_OUTPUT}.min"
    echo "✓ Minified JS: ${JS_OUTPUT}.min"
fi

echo ""
echo "Build complete! The WASM module is ready for use."
