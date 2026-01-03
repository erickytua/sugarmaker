# WASM Build Testing Guide

This document provides instructions for testing the WASM build setup.

## Prerequisites

Before testing, ensure you have:
1. Emscripten SDK installed and configured
2. `emcc` command available in PATH

### Installing Emscripten

**Option 1: Using Docker (Recommended)**
```bash
docker pull emscripten/emsdk
# Run any emcc command through Docker
docker run --rm -v $(pwd):/src -w /src emscripten/emsdk emcc [options]
```

**Option 2: Native Installation**
```bash
# Clone emsdk
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate latest SDK
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## Build Testing

### 1. Navigate to WASM directory
```bash
cd /home/engine/project/wasm
```

### 2. Test basic compilation
```bash
# Test if emcc is available
emcc --version

# Build the module
./build.sh
```

### 3. Verify build output
```bash
# Check if files were created
ls -lh dist/

# Expected output:
# yespower-tidecoin.wasm  (~50-150 KB)
# yespower-tidecoin.js     (~20-50 KB)
```

### 4. Verify file sizes
```bash
# Check WASM file size
du -h dist/yespower-tidecoin.wasm
# Should be under 2MB (ideally under 200KB)
```

## Functionality Testing

### Node.js Testing

```bash
cd /home/engine/project/wasm

# Run the example script
node example.js

# Expected output:
# - Module loads successfully
# - Version information displayed
# - Single hash computed
# - Nonce scan completes
```

### Browser Testing

```bash
cd /home/engine/project/wasm

# Start a simple HTTP server
python3 -m http.server 8000

# Open in browser
# Navigate to: http://localhost:8000/example.html

# Expected:
# - Module loads
# - Module info displayed
# - Buttons work
# - Hash computation succeeds
# - Nonce scan completes
```

## Manual API Testing

### Test 1: Module Loading

**Node.js:**
```javascript
const yespower = require('./dist/yespower-tidecoin.js')();
console.log('Version:', yespower._get_version());
console.log('Expected: sugarmaker-wasm 1.0.0');
```

**Browser Console:**
```javascript
const Module = await import('./dist/yespower-tidecoin.js');
const yespower = await Module.default();
console.log('Version:', yespower._get_version());
```

### Test 2: Algorithm Parameters

```javascript
const params = new Int32Array(3);
yespower._get_algorithm_params(
    params.byteOffset,
    params.byteOffset + 4,
    params.byteOffset + 8
);
console.log('Version:', params[0]);  // Should be 10 (YESPOWER_1_0)
console.log('N:', params[1]);        // Should be 2048
console.log('R:', params[2]);        // Should be 8
```

### Test 3: Single Hash Computation

```javascript
const blockPtr = yespower._malloc(80);
const hashPtr = yespower._malloc(32);

try {
    // Simple test block (all zeros)
    for (let i = 0; i < 80; i++) {
        yespower.setValue(blockPtr + i, 0, 'i8');
    }

    const result = yespower._compute_single_hash(blockPtr, hashPtr);
    console.log('Result:', result);  // Should be 0 (success)

    // Read hash
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

### Test 4: Nonce Scanning

```javascript
const blockPtr = yespower._malloc(80);
const targetPtr = yespower._malloc(32);

try {
    // Set up test block
    for (let i = 0; i < 19; i++) {
        yespower.setValue(blockPtr + (i * 4), 0, 'i32');
    }
    yespower.setValue(blockPtr + 76, 0, 'i32');  // nonce

    // Set very easy target
    for (let i = 0; i < 7; i++) {
        yespower.setValue(targetPtr + (i * 4), 0xFFFFFFFF, 'i32');
    }
    yespower.setValue(targetPtr + 28, 0x0000FFFF, 'i32');

    const found = yespower._scan_tidecoin_hash(
        blockPtr, targetPtr, 0, 1000
    );

    if (found === 1) {
        const nonce = yespower.getValue(blockPtr + 76, 'i32');
        const hashes = yespower._get_hashes_done();
        console.log('Found nonce:', nonce);
        console.log('Hashes computed:', hashes);
    }
} finally {
    yespower._free(blockPtr);
    yespower._free(targetPtr);
}
```

## Troubleshooting

### Build Fails with "emcc: command not found"
**Solution:** Install Emscripten SDK or add to PATH

### Build Fails with "undefined reference"
**Solution:** Check that all required files are present:
- `yespower-opt.c`
- `sha256.c`
- `yespower-platform.c`
- `wasm-wrapper.c`
- `YespowerTidecoin.c`
- `fulltest.c`

### Runtime Error: "Module._malloc is not a function"
**Solution:** Ensure module is properly initialized
- In Node.js: `const yespower = require('./dist/yespower-tidecoin.js')();`
- In Browser: `const yespower = await Module.default();`

### Runtime Error: "Cannot read property of undefined"
**Solution:** Check memory allocation is successful before use
```javascript
const ptr = yespower._malloc(size);
if (ptr === 0) {
    throw new Error('Memory allocation failed');
}
```

### No valid nonce found with easy target
**Solution:** Verify target is in correct byte order (little-endian)
```javascript
// Correct: least significant bytes first
yespower.setValue(targetPtr + 28, 0x0000FFFF, 'i32');

// Wrong: most significant bytes first
yespower.setValue(targetPtr + 28, 0xFFFF0000, 'i32');
```

## Performance Testing

### Measure Hash Rate

```javascript
const iterations = 1000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
    // Compute single hash
    yespower._compute_single_hash(blockPtr, hashPtr);
}

const elapsed = performance.now() - startTime;
const hashesPerSecond = Math.round(iterations * 1000 / elapsed);

console.log(`Hash rate: ${hashesPerSecond} H/s`);
```

### Expected Performance
- Browser: ~100-500 H/s (varies by device)
- Node.js: ~200-800 H/s (varies by system)

## Validation Checklist

Use this checklist to verify the build:

- [ ] Build completes without errors
- [ ] WASM file is created in dist/
- [ ] JS glue file is created in dist/
- [ ] WASM file size is under 2MB
- [ ] Module loads in Node.js
- [ ] Module loads in browser
- [ ] `get_version()` returns "sugarmaker-wasm 1.0.0"
- [ ] `get_hash_size()` returns 32
- [ ] `get_block_size()` returns 80
- [ ] `get_algorithm_params()` returns correct values
- [ ] Single hash computation succeeds
- [ ] Nonce scanning works
- [ ] Memory can be allocated and freed
- [ ] No memory leaks in repeated operations
- [ ] Hashes are deterministic (same input = same output)

## Additional Resources

- [Emscripten Documentation](https://emscripten.org/docs/)
- [WebAssembly Website](https://webassembly.org/)
- [MDN WebAssembly Guide](https://developer.mozilla.org/en-US/docs/WebAssembly)
