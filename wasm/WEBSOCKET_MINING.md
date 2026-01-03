# WebSocket Mining Guide

This guide explains how to use the WASM YespowerTidecoin miner with WebSocket connections to mining pools.

## Overview

Since browsers cannot make direct TCP connections to Stratum mining pools, we use WebSocket as a transport layer. Two server options are provided:

1. **mining-pool-server.js** - A standalone WebSocket mining pool for testing
2. **websocket-proxy-server.js** - A WebSocket-to-Stratum proxy that connects to real mining pools

## Quick Start

### Option 1: Standalone Pool Server (For Testing)

This server implements a simple mining pool with share validation, difficulty adjustment, and job distribution.

```bash
cd wasm

# Install dependencies
npm install --save-prod ws

# Start the pool server (port 8080, difficulty 1000)
node mining-pool-server.js 8080 1000

# Or use npm script
npm run start:pool -- 8080 1000
```

**Commands:**
- `s` - Show statistics
- `d` - Randomize difficulty
- `q` - Quit
- `?` - Help

### Option 2: WebSocket-to-Stratum Proxy

This proxy server acts as a bridge between WebSocket clients and real Stratum mining pools.

```bash
cd wasm

# Install dependencies
npm install --save-prod ws

# Start proxy server (WebSocket port 8080, connects to pool)
node websocket-proxy-server.js 8080 "stratum+tcp://pool.example.com:3333"

# Or use npm script
npm run start:proxy -- 8080 "stratum+tcp://pool.example.com:3333"
```

## Browser Miner

Open `pool-miner.html` in your browser:

```bash
# Option 1: Direct file open
open pool-miner.html

# Option 2: HTTP server
python3 -m http.server 8081
# Navigate to: http://localhost:8081/pool-miner.html
```

### Configuration

1. **WebSocket URL**: The WebSocket server address
   - For standalone pool: `ws://localhost:8080`
   - For proxy: `ws://localhost:8080` (proxy connects to real pool)

2. **Pool Address**: (for proxy only) The Stratum pool address
   - Format: `stratum+tcp://pool.example.com:3333`

3. **Wallet Address**: Your Tidecoin/Sugarchain wallet address

4. **Worker Name**: Identifier for your miner (default: `wasm-miner-1`)

### Mining Statistics

The miner displays:
- **Hash Rate**: Hashes computed per second
- **Shares Accepted**: Valid shares submitted to pool
- **Shares Rejected**: Invalid shares (wrong difficulty)
- **Difficulty**: Current mining difficulty
- **Best Share**: Highest share value found
- **Current Nonce**: Current nonce being tested

## Protocol

### WebSocket Message Format

#### Client → Server

**Subscribe to mining:**
```json
{
  "id": 1,
  "method": "mining.subscribe",
  "params": ["worker-name", null]
}
```

**Authorize with wallet:**
```json
{
  "id": 2,
  "method": "mining.authorize",
  "params": ["wallet-address", "password"]
}
```

**Submit share:**
```json
{
  "id": 3,
  "method": "mining.submit",
  "params": [
    "wallet-address",
    "job-id",
    "nonce-hex",
    "time-hex",
    "extra-nonce2"
  ]
}
```

#### Server → Client

**Subscribe response:**
```json
{
  "id": 1,
  "result": [
    "extranonce1",
    "extranonce2-size",
    ["extranonce2"]
  ]
}
```

**Authorize response:**
```json
{
  "id": 2,
  "result": true
}
```

**New mining job:**
```json
{
  "method": "mining.notify",
  "params": [
    "job-id",
    "previous-hash",
    "coinbase1",
    "coinbase2",
    ["merkle-branch"],
    "version",
    "bits",
    "time",
    true
  ]
}
```

**Set difficulty:**
```json
{
  "method": "mining.set_difficulty",
  "params": [1000]
}
```

## Standalone Pool Server Details

### Features

- **Job Distribution**: Distributes mining jobs to connected miners
- **Share Validation**: Validates shares meet difficulty requirements
- **Difficulty Adjustment**: Manually adjust difficulty (`d` command)
- **Statistics**: Tracks shares, accepts/rejects, blocks found
- **Multi-miner Support**: Handle multiple concurrent miners

### Configuration

```javascript
const server = new MiningPoolServer({
    port: 8080,      // WebSocket port
    difficulty: 1000    // Starting difficulty
});
```

### API

```javascript
// Start server
server.start();

// Get statistics
const stats = server.getStats();
console.log(stats);

// Set difficulty
server.setDifficulty(2000);

// Broadcast to all miners
server.broadcast('mining.notify', [jobParams]);
```

## Proxy Server Details

### Features

- **WebSocket Server**: Accepts connections from browser miners
- **Stratum Client**: Connects to real mining pools via TCP
- **Message Translation**: Converts between WebSocket and Stratum protocols
- **Connection Management**: Handles pool reconnection and client disconnects
- **Statistics**: Tracks miner activity and pool status

### Configuration

```javascript
const proxy = new WebSocketProxyServer({
    port: 8080,
    poolAddress: 'stratum+tcp://pool.example.com:3333'
});
proxy.start();
```

### Architecture

```
Browser Miner (WebSocket)
       ↓
WebSocket Server (Proxy)
       ↓
TCP Connection
       ↓
Stratum Mining Pool
```

### API

```javascript
// Start proxy
proxy.start();

// Get statistics
const stats = proxy.getStats();
console.log(stats);
```

### Statistics Output

```javascript
{
  "port": 8080,
  "poolAddress": "stratum+tcp://pool.example.com:3333",
  "poolConnected": true,
  "connectedMiners": 1,
  "miners": [
    {
      "username": "your-wallet-address",
      "workerName": "wasm-miner-1",
      "authorized": true,
      "subscribed": true,
      "stats": {
        "shares": 100,
        "accepted": 98,
        "rejected": 2,
        "startTime": 1234567890
      }
    }
  ]
}
```

## Mining Flow

### 1. Connection

```
Browser → WebSocket Server → Stratum Pool
```

1. Browser connects to WebSocket server
2. WebSocket server (or proxy) connects to Stratum pool
3. Miners subscribe to mining

### 2. Subscription

```
Client: mining.subscribe
Server: mining.notify (first job)
Server: mining.set_difficulty
```

### 3. Authorization

```
Client: mining.authorize (wallet address)
Server: true (authorized)
```

### 4. Mining Loop

```
1. Receive job from pool
2. Compute hashes in WASM
3. Check if hash meets difficulty
4. If yes, submit share
5. Receive new job on submit
6. Repeat
```

### 5. Share Submission

```
Client: mining.submit (nonce, hash)
Server: true (accepted) or error (rejected)
```

## Performance Considerations

### Hash Rate Optimization

- Use Web Workers to prevent UI blocking
- Batch hash computations
- Adjust nonce range per iteration
- Optimize memory allocation/reuse

### Network Optimization

- Minimize WebSocket message size
- Use binary messages if possible
- Implement connection pooling for multiple miners
- Handle connection retries gracefully

### Difficulty Adjustment

- Start with lower difficulty for faster shares
- Gradually increase based on hash rate
- Monitor reject/accept ratio

## Troubleshooting

### Connection Issues

**Cannot connect to WebSocket server:**
- Check server is running: `node mining-pool-server.js`
- Check port is not in use: `netstat -an | grep 8080`
- Check firewall settings

**Pool connection fails (proxy):**
- Verify pool address format: `stratum+tcp://host:port`
- Check pool is online
- Verify pool supports YespowerTidecoin

### Mining Issues

**No shares being submitted:**
- Check difficulty is not too high
- Verify wallet address is valid
- Check mining is actually running (hash rate > 0)

**All shares rejected:**
- Check block header construction
- Verify nonce format (hex string)
- Check time field is current

### WASM Issues

**Hash computation fails:**
- Check WASM module is loaded
- Verify memory allocation is correct
- Check block data is 80 bytes

## Security Considerations

### For Testing

- Use wallet addresses from testnet
- Limit difficulty to prevent spam
- Monitor miner connections
- Implement rate limiting

### For Production

- Implement proper authentication
- Use TLS/WSS for connections
- Validate all inputs
- Implement share verification
- Rate limit submissions

## Example: Full Setup

### 1. Start Pool Server

```bash
cd wasm
npm install --save-prod ws
node mining-pool-server.js 8080 1000
```

### 2. Start Browser Miner

Open `pool-miner.html` in browser, configure:
- WebSocket URL: `ws://localhost:8080`
- Wallet Address: `test-wallet-address`
- Worker Name: `browser-miner-1`

### 3. Start Mining

Click "Connect", then watch statistics:
- Hash rate: ~100-500 H/s
- Shares accepted: increasing
- Difficulty: as configured

## Advanced Usage

### Multiple Miners

Open multiple browser tabs/windows with different worker names:
- `wasm-miner-1`
- `wasm-miner-2`
- `wasm-miner-3`

### Web Worker Integration

Move mining to Web Worker to prevent UI blocking:

```javascript
// worker.js
importScripts('./dist/yespower-tidecoin.js');

self.onmessage = async (event) => {
    const Module = await Module.default();
    // Mining logic here
};

// main.js
const worker = new Worker('worker.js');
worker.postMessage({ job: currentJob });
```

### Pool Statistics API

Both servers provide statistics via API:

```javascript
const stats = server.getStats();
console.log(stats);
```

## Real Pool Integration

To connect to real Tidecoin/Sugarchain pools:

1. Find a pool supporting YespowerTidecoin
2. Use WebSocket-to-Stratum proxy
3. Configure pool-miner.html with proxy WebSocket URL
4. Enter your real wallet address

## Resources

- **Main README**: `README.md`
- **Quick Start**: `QUICK_START.md`
- **Build Guide**: `BUILD_TESTING.md`
- **Pool Protocol**: [Stratum Mining Protocol](https://miningpoolstats.stream/stratum-mining-protocol/)

## Support

For issues:
1. Check this documentation
2. Review server logs
3. Test with standalone pool first
4. Check pool compatibility
