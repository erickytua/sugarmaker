# WebSocket Mining Quick Start

Quick start guide for setting up WebSocket mining with YespowerTidecoin WASM.

## Quick Start (Testing)

### 1. Install Dependencies

```bash
cd wasm
npm install --save-prod ws
```

### 2. Start Pool Server

```bash
# Start simple pool server
node mining-pool-server.js 8080 1000
```

### 3. Open Browser Miner

```bash
# Start HTTP server
python3 -m http.server 8081

# Open in browser
open http://localhost:8081/pool-miner.html
```

### 4. Connect and Mine

1. Configure:
   - WebSocket URL: `ws://localhost:8080`
   - Wallet Address: any (for testing)
   - Worker Name: `test-miner`

2. Click "Connect"

3. Watch mining statistics!

## Using Web Workers (Recommended for Performance)

Use `pool-miner-worker.html` for multi-threaded mining:

1. Open `pool-miner-worker.html`
2. Set thread count (1-4)
3. Connect and start mining

Benefits:
- UI doesn't freeze during mining
- Higher hash rate with multiple workers
- Better responsiveness

## Connecting to Real Pools

### Step 1: Start Proxy Server

```bash
node websocket-proxy-server.js 8080 "stratum+tcp://pool.example.com:3333"
```

### Step 2: Configure Miner

In `pool-miner.html`:
- WebSocket URL: `ws://localhost:8080`
- Pool Address: `stratum+tcp://pool.example.com:3333`
- Wallet Address: Your real Tidecoin address

### Step 3: Start Mining

Click "Connect" and wait for authorization, then mining starts automatically.

## Files Reference

| File | Purpose |
|------|---------|
| `pool-miner.html` | Single-threaded browser miner |
| `pool-miner-worker.html` | Multi-threaded browser miner (recommended) |
| `mining-worker.js` | Web Worker for mining operations |
| `mining-pool-server.js` | Standalone pool for testing |
| `websocket-proxy-server.js` | WebSocket-to-Stratum proxy |
| `WEBSOCKET_MINING.md` | Full documentation |

## Configuration Examples

### Testing Configuration

```javascript
// Pool Server
Port: 8080
Difficulty: 1000 (low for fast shares)

// Miner
WebSocket URL: ws://localhost:8080
Wallet: test-wallet-123
Worker: test-worker
```

### Production Configuration

```javascript
// Proxy Server
Port: 8080
Pool: stratum+tcp://tidecoin.pool.com:3333

// Miner
WebSocket URL: ws://your-proxy.com:8080
Wallet: TIDEyour-real-wallet-address
Worker: wasm-browser-miner
Threads: 2-4
```

## Performance Tips

1. **Use Web Workers**: Prevents UI blocking, allows parallel mining
2. **Multiple Threads**: Use 2-4 workers for higher hash rate
3. **Optimize Difficulty**: Start low, increase as hash rate improves
4. **Keep Connection Alive**: Handle reconnects automatically
5. **Batch Submissions**: Don't submit every share, wait for better ones

## Troubleshooting

### Won't Connect

- Check pool server is running
- Verify WebSocket URL: `ws://localhost:8080` (not `http://`)
- Check firewall allows WebSocket connections

### No Shares

- Verify wallet address is valid
- Check difficulty isn't too high
- Ensure mining is actually running (hash rate > 0)
- Check pool logs for errors

### Low Hash Rate

- Use Web Worker version
- Increase thread count
- Check browser supports WebAssembly
- Close other browser tabs

## Commands Reference

### Pool Server

```bash
# Start pool
node mining-pool-server.js [port] [difficulty]

# Example
node mining-pool-server.js 8080 1000
```

Interactive commands (when running):
- `s` - Show statistics
- `d` - Randomize difficulty
- `q` - Quit
- `?` - Help

### Proxy Server

```bash
# Start proxy
node websocket-proxy-server.js [port] [pool-address]

# Example
node websocket-proxy-server.js 8080 "stratum+tcp://pool.example.com:3333"
```

## Next Steps

1. Read full documentation: `WEBSOCKET_MINING.md`
2. Test with standalone pool server
3. Try Web Worker version for better performance
4. Configure proxy for real pool connection
5. Deploy to production environment

## Support

- Full documentation: `WEBSOCKET_MINING.md`
- WASM build: `QUICK_START.md`
- Testing guide: `BUILD_TESTING.md`
