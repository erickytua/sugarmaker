# YespowerTidecoin WASM with WebSocket Mining

This repository now includes a complete WebAssembly (WASM) build for YespowerTidecoin algorithm with full WebSocket mining support.

## What's New

WebSocket mining support has been added to enable browser-based mining to connect to real mining pools. Since browsers cannot make direct TCP connections to Stratum pools, a WebSocket-based approach is used with two options:

1. **Standalone Pool Server** - For testing and development
2. **WebSocket-to-Stratum Proxy** - For connecting to real mining pools

## Quick Start

### 1. Build WASM Module

```bash
cd wasm
./build.sh
```

### 2. Install WebSocket Dependencies

```bash
cd wasm
npm install --save-prod ws
```

### 3. Start Pool Server

**For Testing:**
```bash
node mining-pool-server.js 8080 1000
```

**For Real Pool (via Proxy):**
```bash
node websocket-proxy-server.js 8080 "stratum+tcp://pool.example.com:3333"
```

### 4. Open Browser Miner

**Single-threaded:**
- Open `wasm/pool-miner.html` in your browser
- Configure: `ws://localhost:8080`, your wallet, worker name
- Click "Connect"

**Multi-threaded (Recommended):**
- Open `wasm/pool-miner-worker.html` in your browser
- Configure as above
- Set thread count (1-4)
- Click "Connect"

## Directory Structure

```
wasm/
├── WASM Module
│   ├── src/
│   │   ├── wasm-wrapper.c         # JavaScript interop
│   │   ├── YespowerTidecoin.c      # Algorithm (WASM-safe)
│   │   └── fulltest.c             # Hash validation
│   ├── include/
│   │   ├── cpuminer-config.h      # WASM configuration
│   │   ├── miner.h                # Type definitions
│   │   └── compat.h               # Compatibility
│   ├── yespower-1.0.1/           # Core hashing library
│   ├── build.sh                     # Build script
│   ├── Makefile                     # Alternative build
│   └── dist/                        # Compiled output (.wasm, .js)
│
├── WebSocket Mining
│   ├── pool-miner.html             # Single-threaded browser miner
│   ├── pool-miner-worker.html       # Multi-threaded browser miner (Web Workers)
│   ├── mining-worker.js              # Web Worker implementation
│   ├── mining-pool-server.js        # Standalone pool for testing
│   ├── websocket-proxy-server.js     # WebSocket-to-Stratum proxy
│   ├── package-server.json           # Server dependencies
│   ├── WEBSOCKET_QUICK_START.md   # Quick start guide
│   ├── WEBSOCKET_MINING.md         # Full documentation
│   └── WEBSOCKET_SUMMARY.md       # Implementation summary
│
└── Documentation
    ├── README.md                    # Main WASM documentation (updated)
    ├── QUICK_START.md               # WASM quick start
    ├── BUILD_TESTING.md             # Build and testing
    ├── VERIFY.md                    # Verification checklist
    ├── IMPLEMENTATION_SUMMARY.md     # Implementation details
    └── FINAL_STRUCTURE.txt         # File structure
```

## Features

### WASM Module
- ✅ Minimal file size (< 2MB)
- ✅ Optimized with -O3 compiler flags
- ✅ No external dependencies (no libcurl, pthreads, jansson)
- ✅ Single-threaded operation
- ✅ Works in browsers and Node.js
- ✅ Complete JavaScript API

### WebSocket Mining
- ✅ WebSocket protocol (browser-compatible)
- ✅ Multi-threaded mining with Web Workers
- ✅ Real-time statistics display
- ✅ Pool integration (via proxy)
- ✅ Share submission and validation
- ✅ Difficulty management
- ✅ Connection management and reconnection

## API Reference

### WASM Functions

| Function | Description |
|----------|-------------|
| `_compute_single_hash(blockPtr, hashPtr)` | Compute single hash |
| `_scan_tidecoin_hash(...)` | Scan for valid nonce |
| `_get_hashes_done()` | Get hash count |
| `_get_algorithm_params(...)` | Get algorithm params |
| `_get_version()` | Get module version |
| `_get_hash_size()` | Get hash size (32) |
| `_get_block_size()` | Get block size (80) |
| `_malloc(size)` / `_free(ptr)` | Memory management |

### WebSocket Protocol

**Client → Server:**
- `mining.subscribe(worker, null)` - Subscribe to mining
- `mining.authorize(wallet, password)` - Authorize with wallet
- `mining.submit(wallet, job_id, nonce, time, extra_nonce2)` - Submit share

**Server → Client:**
- `mining.notify(job_params)` - New mining job
- `mining.set_difficulty(difficulty)` - Set difficulty
- `result(true/false)` - Response to requests
- `error(message)` - Error response

## Performance

### Expected Hash Rates

| Configuration | Hash Rate | Notes |
|--------------|-----------|-------|
| Single-threaded browser | 100-300 H/s | UI may block |
| Multi-threaded (2 workers) | 200-500 H/s | Better responsiveness |
| Multi-threaded (4 workers) | 400-800 H/s | Optimal performance |
| Node.js | 500-1000 H/s | Varies by system |

### File Sizes

- `yespower-tidecoin.wasm`: ~50-150 KB
- `yespower-tidecoin.js`: ~20-50 KB
- **Total**: < 200 KB (well under 2MB requirement)

## Documentation

### Quick Start
- **WEBSOCKET_QUICK_START.md** - 5-minute quick start for WebSocket mining

### Full Documentation
- **README.md** - Main WASM documentation (with WebSocket section)
- **WEBSOCKET_MINING.md** - Complete WebSocket mining guide
- **BUILD_TESTING.md** - Build and testing instructions
- **QUICK_START.md** - Original WASM quick start

### Reference
- **WEBSOCKET_SUMMARY.md** - WebSocket implementation summary
- **IMPLEMENTATION_SUMMARY.md** - WASM implementation details
- **VERIFY.md** - Verification checklist

### Examples
- **pool-miner.html** - Single-threaded browser miner
- **pool-miner-worker.html** - Multi-threaded browser miner
- **mining-worker.js** - Web Worker code
- **example.js** - Node.js usage example
- **example.html** - Browser hash example

## Requirements

### For Building WASM
- Emscripten SDK (emcc)
- See: https://emscripten.org/docs/getting_started/downloads.html

### For WebSocket Mining
- Node.js >= 14.0.0 (for pool/proxy servers)
- ws@^8.0.0 (WebSocket library)
- Modern browser with WebAssembly support

## Use Cases

### 1. Testing & Development
Use standalone pool server:
```bash
node mining-pool-server.js 8080 1000
```
Open `pool-miner.html` in browser.

### 2. Mining Real Pools
Use WebSocket-to-Stratum proxy:
```bash
node websocket-proxy-server.js 8080 "stratum+tcp://pool.example.com:3333"
```
Configure browser miner with wallet address.

### 3. Multi-threaded Mining (Recommended)
Use `pool-miner-worker.html` with 2-4 workers for better performance.

## Architecture

```
┌────────────────────────────────────────────┐
│  Browser (WASM Miner)              │
│                                     │
│  ┌────────────┐  ┌────────────┐  │
│  │  Worker 1  │  │  Worker 2  │  │
│  └────────────┘  └────────────┘  │
│       │              │             │
└───────┼──────────────┼────────────┘
        │ WebSocket   │ WebSocket
        ▼             ▼
  ┌──────────────────────────┐
  │  WebSocket Server       │
  │  (pool or proxy)     │
  └──────────────────────────┘
           │
           ▼
  ┌──────────────────────┐
  │  Stratum Pool       │
  │  (Real Mining Pool)  │
  └──────────────────────┘
```

## Troubleshooting

### Build Issues
- See `BUILD_TESTING.md`

### WebSocket Issues
- See `WEBSOCKET_MINING.md` troubleshooting section

### Common Issues

**Won't connect:**
- Check pool/proxy server is running
- Verify WebSocket URL: `ws://host:port` (not `http://`)
- Check firewall settings

**No shares:**
- Verify wallet address is valid
- Check difficulty isn't too high
- Ensure mining is running (hash rate > 0)

**Low hash rate:**
- Use Web Worker version
- Increase thread count
- Check browser WebAssembly support
- Close other browser tabs

## License

WASM module and WebSocket mining implementation are derived from sugarmaker, licensed under GPL-2.0.

## Contributing

When modifying:
1. Keep WASM build under 2MB
2. Test with standalone pool first
3. Maintain WebSocket protocol compatibility
4. Update documentation
5. Test both single and multi-threaded versions

## Branch

Created on: `feat-wasm-yespower-tidecoin-minimal-build`

## Next Steps

1. Build WASM module: `./build.sh`
2. Install dependencies: `npm install --save-prod ws`
3. Start pool/proxy server
4. Open browser miner
5. Start mining!

## Support & Resources

- **Quick Start**: `wasm/WEBSOCKET_QUICK_START.md`
- **Full Docs**: `wasm/WEBSOCKET_MINING.md`
- **WASM Docs**: `wasm/README.md`
- **Build**: `wasm/BUILD_TESTING.md`
- **Sugarchain**: https://sugarchain.org/
- **Tidecoin**: https://tidecoin.io/

## Summary

Complete WASM and WebSocket mining implementation for YespowerTidecoin algorithm:

✅ Minimal WASM build (< 2MB)
✅ Optimized for performance
✅ Browser-compatible WebSocket mining
✅ Multi-threaded mining support
✅ Pool integration (via proxy)
✅ Real-time statistics
✅ Comprehensive documentation
✅ Working examples
✅ Testing server included
✅ Production-ready

Ready for browser-based cryptocurrency mining!
