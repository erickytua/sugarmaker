# YespowerTidecoin WASM Module

A minimal, optimized WebAssembly implementation of the YespowerTidecoin hashing algorithm for Sugarchain/Tidecoin. This module enables high-performance cryptocurrency hashing in web browsers and Node.js environments.

## Features

- **Optimized WASM Build**: Compiled with Emscripten using `-O3` optimizations for minimal file size and maximum performance
- **Single-Threaded**: No threading dependencies - perfect for browser/Node.js environments
- **Zero External Dependencies**: Self-contained module with no network, JSON, or platform-specific code
- **Small Footprint**: Optimized to be under 2MB for fast loading
- **Flexible API**: Provides both hash scanning and single hash computation functions
- **Cross-Platform**: Works in browsers (modern Chrome, Firefox, Safari, Edge) and Node.js

## Build Requirements

- **Emscripten SDK** (emcc)
  - Installation: https://emscripten.org/docs/getting_started/downloads.html
  - Or use Docker: `docker run --rm -v $(pwd):/src -w /src emscripten/emsdk emcc ...`

## Building

### Using the build script (recommended)

```bash
# Clone or navigate to the wasm directory
cd wasm

# Build the module
./build.sh

# Clean and rebuild
./build.sh clean
```

### Using Make

```bash
cd wasm
make

# Clean build artifacts
make clean

# Show help
make help
```

### Build Output

The build process generates two files in the `dist/` directory:

- `yespower-tidecoin.wasm` - The WebAssembly binary
- `yespower-tidecoin.js` - JavaScript glue code

## Usage

### In the Browser

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>YespowerTidecoin WASM Example</title>
</head>
<body>
    <script type="module">
        import Module from './dist/yespower-tidecoin.js';

        // Initialize the module
        const yespower = await Module();

        // Example: Compute a single hash
        function computeHash(blockData) {
            // Allocate memory for block data (80 bytes)
            const blockPtr = yespower._malloc(80);
            const hashPtr = yespower._malloc(32);

            try {
                // Copy block data to WASM memory
                for (let i = 0; i < 20; i++) {
                    yespower.setValue(blockPtr + (i * 4), blockData[i], 'i32');
                }

                // Compute hash
                const result = yespower._compute_single_hash(blockPtr, hashPtr);

                // Read the hash result
                const hash = new Uint8Array(32);
                for (let i = 0; i < 32; i++) {
                    hash[i] = yespower.getValue(hashPtr + i, 'i8');
                }

                return result === 0 ? hash : null;
            } finally {
                // Free allocated memory
                yespower._free(blockPtr);
                yespower._free(hashPtr);
            }
        }

        // Example: Scan for valid nonce
        function scanForNonce(blockData, target, startNonce, maxNonce) {
            const blockPtr = yespower._malloc(80);
            const targetPtr = yespower._malloc(32);

            try {
                // Copy block data
                for (let i = 0; i < 20; i++) {
                    yespower.setValue(blockPtr + (i * 4), blockData[i], 'i32');
                }

                // Copy target
                for (let i = 0; i < 8; i++) {
                    yespower.setValue(targetPtr + (i * 4), target[i], 'i32');
                }

                // Scan for nonce
                const found = yespower._scan_tidecoin_hash(
                    blockPtr, targetPtr, startNonce, maxNonce
                );

                if (found === 1) {
                    // Read the found nonce
                    const foundNonce = yespower.getValue(blockPtr + 76, 'i32');
                    const hashesDone = yespower._get_hashes_done();
                    return { found: true, nonce: foundNonce, hashesDone };
                } else if (found === 0) {
                    return { found: false, hashesDone: yespower._get_hashes_done() };
                } else {
                    return { found: false, error: true };
                }
            } finally {
                yespower._free(blockPtr);
                yespower._free(targetPtr);
            }
        }

        // Get module info
        console.log('Version:', yespower._get_version());
        console.log('Hash size:', yespower._get_hash_size(), 'bytes');
        console.log('Block size:', yespower._get_block_size(), 'bytes');

        const params = new Int32Array(3);
        yespower._get_algorithm_params(
            params.byteOffset,
            params.byteOffset + 4,
            params.byteOffset + 8
        );
        console.log('Algorithm params:', { version: params[0], N: params[1], r: params[2] });
    </script>
</body>
</html>
```

### In Node.js

```javascript
// Initialize the module
const yespower = require('./dist/yespower-tidecoin.js')();

// Helper function to convert hex string to byte array
function hexToBytes(hex) {
    const bytes = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

// Helper function to convert byte array to hex string
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compute a single hash
function computeSingleHash(blockData) {
    const blockPtr = yespower._malloc(80);
    const hashPtr = yespower._malloc(32);

    try {
        // Copy block data to WASM memory
        const blockBytes = hexToBytes(blockData);
        for (let i = 0; i < blockBytes.length; i++) {
            yespower.setValue(blockPtr + i, blockBytes[i], 'i8');
        }

        // Compute hash
        const result = yespower._compute_single_hash(blockPtr, hashPtr);

        if (result !== 0) {
            throw new Error('Hash computation failed');
        }

        // Read the hash result
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            hash[i] = yespower.getValue(hashPtr + i, 'i8');
        }

        return bytesToHex(hash);
    } finally {
        yespower._free(blockPtr);
        yespower._free(hashPtr);
    }
}

// Example usage
const exampleBlockHeader = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c'.padEnd(160, '0');
const hash = computeSingleHash(exampleBlockHeader);
console.log('Hash:', hash);
```

## API Reference

### Module Functions

#### `compute_single_hash(blockDataPtr, hashOutputPtr)`

Computes a single YespowerTidecoin hash for the given block data.

**Parameters:**
- `blockDataPtr` (number): Pointer to 80-byte block header data in WASM memory
- `hashOutputPtr` (number): Pointer to 32-byte buffer for output hash

**Returns:**
- `0` on success, `-1` on error

#### `scan_tidecoin_hash(blockDataPtr, targetPtr, startNonce, maxNonce)`

Scans for a valid nonce that produces a hash below the target.

**Parameters:**
- `blockDataPtr` (number): Pointer to 80-byte block header data
- `targetPtr` (number): Pointer to 32-byte target (little-endian)
- `startNonce` (number): Starting nonce value (32-bit)
- `maxNonce` (number): Maximum nonce value to scan (32-bit)

**Returns:**
- `1` if valid hash found
- `0` if no valid hash found
- `-1` on error

When successful, `blockDataPtr[19]` will contain the found nonce.

#### `get_hashes_done()`

Returns the number of hashes computed in the last scan operation.

**Returns:**
- `number`: Number of hashes computed

#### `get_algorithm_params(versionPtr, NPtr, rPtr)`

Returns the Yespower algorithm parameters.

**Parameters:**
- `versionPtr` (number): Pointer to store version
- `NPtr` (number): Pointer to store N parameter
- `rPtr` (number): Pointer to store r parameter

**Returns:** void (writes to provided pointers)

#### `get_version()`

Returns the version string of the WASM module.

**Returns:**
- `string`: Version string (e.g., "sugarmaker-wasm 1.0.0")

#### `get_hash_size()`

Returns the size of the hash output in bytes.

**Returns:**
- `number`: Hash size (always 32)

#### `get_block_size()`

Returns the expected block header size in bytes.

**Returns:**
- `number`: Block size (always 80)

### Algorithm Parameters

The YespowerTidecoin algorithm uses the following parameters:

- **Version**: YESPOWER_1_0 (10)
- **N**: 2048
- **R**: 8
- **Personalization**: None

## Performance Considerations

1. **Memory Management**: Always free allocated memory using `_free()` to prevent memory leaks
2. **Batch Operations**: For multiple hash computations, reuse memory allocations when possible
3. **Scanning Range**: Choose appropriate `maxNonce` values to balance speed and completeness
4. **Worker Threads**: In browsers, consider using Web Workers to prevent UI blocking during intensive hash operations

## File Size

The optimized WASM module is designed to be under 2MB. The actual size depends on:
- Optimization flags (currently `-O3`)
- Dead code elimination
- Minification settings

## Troubleshooting

### Build Issues

**Error: `emcc: command not found`**
- Ensure Emscripten SDK is installed and `emcc` is in your PATH
- Source the Emscripten environment file: `source /path/to/emsdk/emsdk_env.sh`

**Error: Module too large**
- Check if dead code elimination is working: look at the build output for eliminated functions
- Consider using `-Oz` instead of `-O3` for smaller size (may be slightly slower)

### Runtime Issues

**Memory allocation failures**
- Use `ALLOW_MEMORY_GROWTH=1` (already enabled in build script)
- Increase initial memory with `-s INITIAL_MEMORY=...` if needed

**Incorrect hash results**
- Ensure byte order is correct (little-endian for block data)
- Verify block header is exactly 80 bytes
- Check target is in correct format (32 bytes, little-endian)

## License

This module is derived from sugarmaker, which is licensed under the GNU General Public License version 2.0. See the COPYING file in the parent directory for details.

## Contributing

When modifying this module:

1. Keep the build under 2MB
2. Maintain compatibility with both browser and Node.js environments
3. Test thoroughly with various block data and target values
4. Update this README for any API changes

## See Also

- [Sugarchain Project](https://sugarchain.org/)
- [Tidecoin](https://tidecoin.io/)
- [Emscripten Documentation](https://emscripten.org/docs/)
- [WebAssembly](https://webassembly.org/)
