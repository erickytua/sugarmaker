# WASM Build for Sugarmaker

This repository now includes a complete WebAssembly (WASM) build for the YespowerTidecoin algorithm.

## Overview

The WASM build provides a minimal, optimized implementation of YespowerTidecoin that can be used in web browsers and Node.js environments without external dependencies.

## Location

All WASM-related files are located in the `/wasm` directory at the repository root.

## Quick Start

1. **Install Emscripten SDK**
   ```bash
   # Using Docker (recommended)
   docker pull emscripten/emsdk

   # Or native installation
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk && ./emsdk install latest && ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **Build the module**
   ```bash
   cd wasm
   ./build.sh
   ```

3. **Use in your project**
   - Node.js: `const yespower = require('./dist/yespower-tidecoin.js')();`
   - Browser: `import Module from './dist/yespower-tidecoin.js'; const yespower = await Module();`

## Documentation

All documentation is in the `/wasm` directory:

- **QUICK_START.md** - Quick start guide (start here!)
- **README.md** - Comprehensive documentation
- **BUILD_TESTING.md** - Build and testing instructions
- **VERIFY.md** - Verification checklist
- **IMPLEMENTATION_SUMMARY.md** - Implementation details

## Features

- ✅ Minimal file size (< 2MB)
- ✅ No external dependencies (no libcurl, pthreads, jansson)
- ✅ Single-threaded operation
- ✅ Optimized with `-O3` compiler flags
- ✅ Works in browsers and Node.js
- ✅ Comprehensive API documentation
- ✅ Example code included

## Usage Examples

### Node.js

See `wasm/example.js` for a complete example.

```javascript
const yespower = require('./wasm/dist/yespower-tidecoin.js')();

// Allocate memory
const blockPtr = yespower._malloc(80);
const hashPtr = yespower._malloc(32);

try {
    // Copy block data
    for (let i = 0; i < 80; i++) {
        yespower.setValue(blockPtr + i, blockData[i], 'i8');
    }

    // Compute hash
    yespower._compute_single_hash(blockPtr, hashPtr);

    // Read result
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        hash[i] = yespower.getValue(hashPtr + i, 'i8');
    }
} finally {
    yespower._free(blockPtr);
    yespower._free(hashPtr);
}
```

### Browser

See `wasm/example.html` for a complete example.

```html
<script type="module">
    import Module from './wasm/dist/yespower-tidecoin.js';
    const yespower = await Module();

    console.log('Version:', yespower._get_version());

    // Use same API as Node.js
</script>
```

## Exported Functions

| Function | Description |
|----------|-------------|
| `_compute_single_hash(blockPtr, hashPtr)` | Compute single hash |
| `_scan_tidecoin_hash(blockPtr, targetPtr, startNonce, maxNonce)` | Scan for valid nonce |
| `_get_hashes_done()` | Get hash count from last scan |
| `_get_algorithm_params(vPtr, nPtr, rPtr)` | Get algorithm params |
| `_get_version()` | Get module version |
| `_get_hash_size()` | Get hash size (32 bytes) |
| `_get_block_size()` | Get block size (80 bytes) |
| `_malloc(size)` | Allocate memory |
| `_free(ptr)` | Free memory |

## Build Output

After building, you'll find:
- `wasm/dist/yespower-tidecoin.wasm` - WebAssembly binary (~50-150 KB)
- `wasm/dist/yespower-tidecoin.js` - JavaScript glue code (~20-50 KB)

## Directory Structure

```
wasm/
├── README.md                    # Comprehensive documentation
├── QUICK_START.md               # Quick start guide
├── BUILD_TESTING.md             # Testing instructions
├── VERIFY.md                   # Verification checklist
├── IMPLEMENTATION_SUMMARY.md     # Implementation details
├── build.sh                    # Build script
├── Makefile                    # Alternative build config
├── package.json                # npm package metadata
├── example.js                  # Node.js example
├── example.html                # Browser example
├── src/                        # C source files
│   ├── wasm-wrapper.c          # JavaScript interop
│   ├── YespowerTidecoin.c     # Algorithm implementation
│   └── fulltest.c             # Hash validation
├── include/                    # Headers
│   ├── cpuminer-config.h      # WASM configuration
│   ├── miner.h                # Type definitions
│   └── compat.h               # Compatibility
└── yespower-1.0.1/           # Core hashing library
    ├── yespower-opt.c         # Optimized implementation
    ├── sha256.c               # SHA-256
    ├── sha256.h
    ├── yespower.h             # API header
    ├── sysendian.h            # Endian conversion
    └── yespower-platform.c    # WASM platform code
```

## Testing

### Node.js
```bash
cd wasm
node example.js
```

### Browser
```bash
cd wasm
python3 -m http.server 8000
# Open http://localhost:8000/example.html
```

## Algorithm Parameters

- Version: YESPOWER_1_0 (10)
- N: 2048
- R: 8
- Block size: 80 bytes
- Hash size: 32 bytes

## Performance

Expected hash rates:
- Browser: ~100-500 H/s (varies by device)
- Node.js: ~200-800 H/s (varies by system)

## License

The WASM build is derived from sugarmaker, licensed under GPL-2.0.

## Support

For detailed information:
- Start with `wasm/QUICK_START.md`
- See `wasm/README.md` for full documentation
- Check `wasm/BUILD_TESTING.md` for troubleshooting

## Branch

This WASM build was created on the `feat-wasm-yespower-tidecoin-minimal-build` branch.
