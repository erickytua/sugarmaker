#!/usr/bin/env node

/**
 * WebSocket to Stratum Proxy Server
 *
 * This server acts as a bridge between WebSocket clients (browser WASM miners)
 * and Stratum mining pools (TCP).
 *
 * Features:
 * - WebSocket server for browser clients
 * - Stratum TCP client for pool connection
 * - Message translation between WebSocket and Stratum
 * - Connection management for multiple miners
 * - Share tracking and statistics
 */

const WebSocket = require('ws');
const net = require('net');
const EventEmitter = require('events');

class StratumClient extends EventEmitter {
    constructor(poolAddress) {
        super();
        this.poolAddress = poolAddress;
        this.socket = null;
        this.connected = false;
        this.messageId = 1;
        this.pendingMessages = new Map();
    }

    connect() {
        const [host, port] = this.poolAddress.replace('stratum+tcp://', '').split(':');

        console.log(`[Stratum] Connecting to pool: ${host}:${port}`);

        this.socket = new net.Socket();
        this.socket.connect(parseInt(port), host);

        this.socket.on('connect', () => {
            console.log('[Stratum] Connected to pool');
            this.connected = true;
            this.emit('connected');
        });

        this.socket.on('data', (data) => {
            this.handleData(data.toString());
        });

        this.socket.on('error', (error) => {
            console.error('[Stratum] Error:', error.message);
            this.emit('error', error);
        });

        this.socket.on('close', () => {
            console.log('[Stratum] Connection closed');
            this.connected = false;
            this.emit('disconnected');
        });
    }

    handleData(data) {
        const messages = data.trim().split('\n');
        for (const msg of messages) {
            if (!msg) continue;

            try {
                const parsed = JSON.parse(msg);
                console.log(`[Stratum] Received:`, parsed);
                this.emit('message', parsed);
            } catch (error) {
                console.error('[Stratum] Failed to parse message:', msg);
            }
        }
    }

    send(method, params = []) {
        const id = this.messageId++;
        const message = { id, method, params };
        const json = JSON.stringify(message) + '\n';

        console.log('[Stratum] Sending:', message);
        this.socket.write(json);
        return id;
    }

    authorize(username, password) {
        return this.send('mining.authorize', [username, password || null]);
    }

    subscribe(workerName) {
        return this.send('mining.subscribe', [workerName || null, null]);
    }

    submit(username, jobId, nonce, time, extraNonce2) {
        return this.send('mining.submit', [
            username,
            jobId,
            nonce,
            time,
            extraNonce2 || null
        ]);
    }
}

class MinerClient {
    constructor(ws, stratum) {
        this.ws = ws;
        this.stratum = stratum;
        this.authorized = false;
        this.subscribed = false;
        this.username = null;
        this.workerName = null;
        this.stats = {
            shares: 0,
            accepted: 0,
            rejected: 0,
            startTime: Date.now()
        };
    }

    send(method, params, id = null) {
        const message = id ? { id, result: params } : { method, params };
        const json = JSON.stringify(message);
        console.log(`[WS->Client] Sending:`, method || 'response');
        this.ws.send(json);
    }

    sendError(id, message) {
        const error = { id, error: { code: -1, message } };
        this.ws.send(JSON.stringify(error));
    }

    handleMessage(message) {
        console.log(`[WS<-Client] Received:`, message.method || 'response', message.id);

        // Handle responses
        if (message.id) {
            this.handleResponse(message);
            return;
        }

        // Handle method calls
        if (message.method) {
            this.handleMethod(message);
        }
    }

    handleResponse(message) {
        // Response is handled by Stratum client and forwarded
    }

    handleMethod(message) {
        const { method, params } = message;

        switch (method) {
            case 'mining.subscribe':
                this.subscribe(params[0], params[1]);
                break;

            case 'mining.authorize':
                this.authorize(params[0], params[1]);
                break;

            case 'mining.submit':
                this.submit(params[0], params[1], params[2], params[3], params[4]);
                break;

            default:
                console.log(`[WS<-Client] Unknown method: ${method}`);
                break;
        }
    }

    subscribe(workerName) {
        this.workerName = workerName;
        this.subscribed = true;

        // Subscribe to pool
        this.stratum.once('mining.notify', (job) => {
            this.send('mining.notify', job);
        });

        this.stratum.once('mining.set_difficulty', (difficulty) => {
            this.send('mining.set_difficulty', [difficulty]);
        });

        this.stratum.subscribe(workerName);
        this.send(null, null, 1); // Success response
    }

    authorize(username, password) {
        this.username = username;

        this.stratum.authorize(username, password).then((response) => {
            if (response.error) {
                this.sendError(2, response.error.message);
            } else {
                this.authorized = true;
                this.send(null, true, 2); // Success response
                console.log(`[Miner] ${username}@${this.workerName} authorized`);
            }
        });
    }

    submit(username, jobId, nonce, time, extraNonce2) {
        if (!this.authorized) {
            this.sendError(messageId, 'Not authorized');
            return;
        }

        this.stratum.submit(username, jobId, nonce, time, extraNonce2);
    }
}

class WebSocketProxyServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.poolAddress = options.poolAddress;
        this.stratum = null;
        this.wss = null;
        this.miners = new Map();
    }

    start() {
        // Connect to Stratum pool
        if (this.poolAddress) {
            this.connectToPool();
        }

        // Start WebSocket server
        this.wss = new WebSocket.Server({ port: this.port });
        console.log(`[Proxy] WebSocket server listening on port ${this.port}`);

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        this.wss.on('error', (error) => {
            console.error('[Proxy] WebSocket error:', error);
        });
    }

    connectToPool() {
        this.stratum = new StratumClient(this.poolAddress);
        this.stratum.connect();

        this.stratum.on('connected', () => {
            console.log('[Proxy] Connected to pool');
            this.broadcastToMiners({ method: 'pool.connected' });
        });

        this.stratum.on('disconnected', () => {
            console.log('[Proxy] Disconnected from pool');
            this.broadcastToMiners({ method: 'pool.disconnected' });
            // Reconnect after 5 seconds
            setTimeout(() => this.connectToPool(), 5000);
        });

        this.stratum.on('message', (message) => {
            this.handleStratumMessage(message);
        });

        this.stratum.on('error', (error) => {
            console.error('[Proxy] Pool error:', error);
            this.broadcastToMiners({ method: 'pool.error', params: [error.message] });
        });
    }

    handleConnection(ws, req) {
        const minerId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        console.log(`[Proxy] New miner connection: ${minerId}`);

        const miner = new MinerClient(ws, this.stratum);
        this.miners.set(minerId, miner);

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                miner.handleMessage(message);
            } catch (error) {
                console.error(`[Proxy] Invalid message from ${minerId}:`, error);
            }
        });

        ws.on('close', () => {
            console.log(`[Proxy] Miner disconnected: ${minerId}`);
            this.miners.delete(minerId);
        });

        ws.on('error', (error) => {
            console.error(`[Proxy] Miner error ${minerId}:`, error);
        });
    }

    handleStratumMessage(message) {
        // Forward Stratum messages to all miners
        if (message.method === 'mining.notify') {
            this.broadcastToMiners(message);
        } else if (message.method === 'mining.set_difficulty') {
            this.broadcastToMiners(message);
        } else if (message.method === 'mining.set_extranonce') {
            this.broadcastToMiners(message);
        } else if (message.error) {
            // Handle error responses
            const miner = Array.from(this.miners.values())[0]; // Simplified
            if (miner) {
                miner.sendError(message.id, message.error.message);
            }
        } else if (message.result !== undefined) {
            // Handle success responses
            const miner = Array.from(this.miners.values())[0]; // Simplified
            if (miner && message.id) {
                miner.send(null, message.result, message.id);
            }
        }
    }

    broadcastToMiners(message) {
        const json = JSON.stringify(message);
        for (const [minerId, miner] of this.miners) {
            try {
                miner.ws.send(json);
            } catch (error) {
                console.error(`[Proxy] Failed to send to ${minerId}:`, error);
            }
        }
    }

    getStats() {
        return {
            port: this.port,
            poolAddress: this.poolAddress,
            poolConnected: this.stratum ? this.stratum.connected : false,
            connectedMiners: this.miners.size,
            miners: Array.from(this.miners.values()).map(m => ({
                username: m.username,
                workerName: m.workerName,
                authorized: m.authorized,
                subscribed: m.subscribed,
                stats: m.stats
            }))
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const port = parseInt(args[0]) || 8080;
    const poolAddress = args[1] || null;

    console.log('WebSocket to Stratum Proxy Server');
    console.log('=====================================');
    console.log(`WebSocket Port: ${port}`);
    console.log(`Pool Address: ${poolAddress || 'None (pool mode)'}`);
    console.log('');

    const server = new WebSocketProxyServer({ port, poolAddress });
    server.start();

    // Stats interval
    setInterval(() => {
        const stats = server.getStats();
        console.log('\n[Stats]', JSON.stringify(stats, null, 2));
    }, 30000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Proxy] Shutting down...');
        process.exit(0);
    });
}

module.exports = WebSocketProxyServer;
