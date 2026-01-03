# Quick Start Guide - YespowerTidecoin WASM

## Installation & Build

### Prerequisites
Install Emscripten SDK:
```bash
# Using Docker
docker pull emscripten/emsdk

# Or native installation
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh
```

### Build
```bash
cd wasm
./build.sh
```

This creates:
- `dist/yespower-tidecoin.wasm` - WebAssembly binary
- `dist/yespower-tidecoin.js` - JavaScript glue code

## Quick Usage Examples

### Node.js
```javascript
const yespower = require('./dist/yespower-tidecoin.js')();

// Get module info
console.log('Version:', yespower._get_version());

// Compute a single hash
const blockPtr = yespower._malloc(80);
const hashPtr = yespower._malloc(32);

try {
    // Copy block data (80 bytes)
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
    console.log('Hash:', Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''));
} finally {
    yespower._free(blockPtr);
    yespower._free(hashPtr);
}
```

### Browser
```html
<script type="module">
    import Module from './dist/yespower-tidecoin.js';
    const yespower = await Module();

    console.log('Version:', yespower._get_version());

    // Same API as Node.js
    // ... (see Node.js example above)
</script>
```

## Running Tests

### Node.js
```bash
node example.js
```

### Browser
```bash
python3 -m http.server 8000
# Open http://localhost:8000/example.html
```

## API Summary

| Function | Description |
|----------|-------------|
| `_compute_single_hash(blockPtr, hashPtr)` | Compute single hash |
| `_scan_tidecoin_hash(blockPtr, targetPtr, startNonce, maxNonce)` | Scan for valid nonce |
| `_get_hashes_done()` | Get hash count from last scan |
| `_get_algorithm_params(vPtr, nPtr, rPtr)` | Get algorithm params |
| `_get_version()` | Get module version |
| `_get_hash_size()` | Get hash size (32) |
| `_get_block_size()` | Get block size (80) |
| `_malloc(size)` | Allocate memory |
| `_free(ptr)` | Free memory |

## Memory Management

Always allocate and free memory:
```javascript
const ptr = yespower._malloc(size);
try {
    // Use ptr...
} finally {
    yespower._free(ptr);
}
```

## Algorithm Parameters

- Version: YESPOWER_1_0 (10)
- N: 2048
- R: 8
- Block size: 80 bytes
- Hash size: 32 bytes

## Documentation

- `README.md` - Full documentation
- `BUILD_TESTING.md` - Testing guide
- `VERIFY.md` - Verification checklist
- `example.js` - Node.js example
- `example.html` - Browser example

## Support

For issues or questions:
1. Check `BUILD_TESTING.md` for troubleshooting
2. Review `example.js` and `example.html`
3. Verify Emscripten is properly installed
