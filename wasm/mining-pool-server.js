#!/usr/bin/env node

/**
 * Simple WebSocket Mining Pool Server
 *
 * This is a standalone WebSocket server for testing WASM miners.
 * It implements a simple mining pool protocol compatible with the pool-miner.html
 * client.
 *
 * Features:
 * - WebSocket server
 * - Simple job distribution
 * - Share validation
 * - Difficulty adjustment
 * - Statistics tracking
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class MiningJob {
    constructor(difficulty = 1) {
        this.id = Math.random().toString(36).substring(7);
        this.difficulty = difficulty;
        this.created = Date.now();

        // Generate random block header
        this.version = '01000000';
        this.prevHash = Array.from({length: 32}, () =>
            Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
        ).join('');
        this.merkleRoot = Array.from({length: 32}, () =>
            Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
        ).join('');
        this.time = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');

        // Target based on difficulty (higher difficulty = lower target)
        const targetValue = Math.pow(2, 32) / difficulty;
        this.bits = this.targetToBits(targetValue);
    }

    targetToBits(target) {
        // Simplified target to bits conversion
        // In real implementation, this would be more complex
        const hexTarget = target.toString(16).padStart(8, '0');
        return 'ffff001d'; // Simplified for testing
    }

    validateHash(hashHex) {
        // Check if hash meets difficulty
        const hashValue = parseInt(hashHex.substring(0, 8), 16);
        const targetValue = Math.pow(2, 32) / this.difficulty;

        return hashValue <= targetValue;
    }
}

class MiningPoolServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.difficulty = options.difficulty || 1000;
        this.wss = null;
        this.miners = new Map();
        this.currentJob = null;
        this.stats = {
            connections: 0,
            shares: 0,
            accepted: 0,
            rejected: 0,
            blocksFound: 0,
            startTime: Date.now()
        };
    }

    start() {
        this.wss = new WebSocket.Server({ port: this.port });
        console.log(`Mining Pool Server listening on ws://0.0.0.0:${this.port}`);
        console.log(`Difficulty: ${this.difficulty}`);
        console.log('');

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        this.wss.on('error', (error) => {
            console.error('[Server] WebSocket error:', error);
        });

        // Generate initial job
        this.generateNewJob();

        // Job rotation (every 2 minutes)
        setInterval(() => {
            this.generateNewJob();
            this.broadcast('mining.notify', this.getJobParams());
        }, 120000);

        // Statistics interval
        setInterval(() => this.printStats(), 60000);
    }

    handleConnection(ws, req) {
        const minerId = req.socket.remoteAddress || `miner_${Date.now()}`;
        const miner = {
            id: minerId,
            ws: ws,
            username: null,
            worker: null,
            authorized: false,
            subscribed: false,
            stats: {
                shares: 0,
                accepted: 0,
                rejected: 0,
                connectTime: Date.now()
            }
        };

        console.log(`[Connect] New miner: ${minerId}`);
        this.stats.connections++;

        this.miners.set(minerId, miner);

        ws.on('message', (data) => {
            try {
                this.handleMessage(miner, JSON.parse(data));
            } catch (error) {
                console.error(`[Error] Invalid message from ${minerId}:`, error);
                this.sendError(miner.ws, -1, 'Invalid JSON message');
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(minerId);
        });

        ws.on('error', (error) => {
            console.error(`[Error] Miner error ${minerId}:`, error);
        });
    }

    handleMessage(miner, message) {
        const { id, method, params } = message;
        console.log(`[Message] ${miner.id}: ${method || 'response'}`);

        // Handle responses
        if (id !== undefined) {
            return; // Responses handled per-request
        }

        // Handle method calls
        switch (method) {
            case 'mining.subscribe':
                this.handleSubscribe(miner, params);
                break;

            case 'mining.authorize':
                this.handleAuthorize(miner, params);
                break;

            case 'mining.submit':
                this.handleSubmit(miner, params);
                break;

            default:
                console.log(`[Warn] Unknown method: ${method}`);
                this.sendError(miner.ws, null, 'Unknown method');
                break;
        }
    }

    handleSubscribe(miner, params) {
        miner.worker = params[0] || 'default-worker';
        miner.subscribed = true;

        console.log(`[Subscribe] Miner ${miner.id} worker: ${miner.worker}`);

        // Send success response
        this.sendResponse(miner.ws, 1, [
            null,               // extranonce1
            this.currentJob.id,  // extranonce2_size
            [null]             // extranonce2 (for subscription)
        ]);

        // Send current job
        this.send(miner.ws, {
            method: 'mining.notify',
            params: this.getJobParams()
        });

        // Send initial difficulty
        this.send(miner.ws, {
            method: 'mining.set_difficulty',
            params: [this.difficulty]
        });
    }

    handleAuthorize(miner, params) {
        const username = params[0];
        const password = params[1];

        miner.username = username;
        miner.authorized = true;

        console.log(`[Authorize] Miner ${miner.id}: ${username}`);

        // Accept any username for testing
        this.sendResponse(miner.ws, 2, true);
    }

    handleSubmit(miner, params) {
        if (!miner.authorized) {
            this.sendError(miner.ws, params.id || null, 'Not authorized');
            return;
        }

        const [username, jobId, nonce, time, extraNonce2] = params;
        miner.stats.shares++;
        this.stats.shares++;

        // Validate job ID
        if (jobId !== this.currentJob.id) {
            console.log(`[Reject] ${miner.id}: Stale job`);
            this.sendError(miner.ws, params.id || null, 'Stale job');
            miner.stats.rejected++;
            this.stats.rejected++;
            return;
        }

        // Validate nonce format
        const nonceNum = parseInt(nonce, 16);
        if (isNaN(nonceNum)) {
            console.log(`[Reject] ${miner.id}: Invalid nonce`);
            this.sendError(miner.ws, params.id || null, 'Invalid nonce');
            miner.stats.rejected++;
            this.stats.rejected++;
            return;
        }

        // Validate share
        const isValid = this.validateShare(miner, nonceNum);

        if (isValid) {
            console.log(`[Accept] ${miner.id}: Nonce ${nonceNum}`);
            this.sendResponse(miner.ws, params.id || Math.floor(Math.random() * 10000), true);
            miner.stats.accepted++;
            this.stats.accepted++;

            // Check if it's a block (very low target)
            if (isValid.block) {
                console.log(`\n*** BLOCK FOUND by ${miner.username} ***\n`);
                this.stats.blocksFound++;

                // Broadcast block found
                this.broadcast('block.found', {
                    miner: miner.username,
                    blockHash: isValid.hash
                });

                // Generate new job
                this.generateNewJob();
                this.broadcast('mining.notify', this.getJobParams());
            }
        } else {
            console.log(`[Reject] ${miner.id}: High difficulty share`);
            this.sendError(miner.ws, params.id || null, 'High difficulty');
            miner.stats.rejected++;
            this.stats.rejected++;
        }
    }

    validateShare(miner, nonce) {
        // Simulate hash computation for validation
        // In a real pool, this would use the full YespowerTidecoin algorithm
        const hashInput = `${this.currentJob.prevHash}${nonce.toString().padStart(8, '0')}`;
        const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

        const meetsDifficulty = this.currentJob.validateHash(hash);

        if (meetsDifficulty) {
            // Check if it's a full block (very rare, simulate with probability)
            const isBlock = Math.random() < 0.001; // 0.1% chance for testing
            return { valid: true, block: isBlock, hash };
        }

        return { valid: false };
    }

    handleDisconnect(minerId) {
        const miner = this.miners.get(minerId);
        if (miner) {
            const uptime = ((Date.now() - miner.stats.connectTime) / 1000 / 60).toFixed(1);
            console.log(`[Disconnect] Miner ${miner.id} (${miner.username || 'unauthorized'})`);
            console.log(`  Shares: ${miner.stats.shares} (A: ${miner.stats.accepted}, R: ${miner.stats.rejected})`);
            console.log(`  Uptime: ${uptime} minutes`);
            this.miners.delete(minerId);
        }
    }

    generateNewJob() {
        this.currentJob = new MiningJob(this.difficulty);
        console.log(`\n[New Job] ID: ${this.currentJob.id}, Difficulty: ${this.currentJob.difficulty}`);
    }

    getJobParams() {
        return [
            this.currentJob.id,
            this.currentJob.prevHash,
            'f0000000',  // coinbase1 (simplified)
            'f0000000',  // coinbase2 (simplified)
            [],           // merkle_branch (empty for testing)
            this.currentJob.version,
            this.currentJob.bits,
            this.currentJob.time,
            true           // clean_jobs
        ];
    }

    send(ws, message) {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('[Error] Failed to send message:', error);
        }
    }

    sendResponse(ws, id, result) {
        const message = { id, result };
        this.send(ws, message);
    }

    sendError(ws, id, message) {
        const message = id ? { id, error: { code: -1, message } } : { error: { code: -1, message } };
        this.send(ws, message);
    }

    broadcast(method, params) {
        const message = { method, params };
        const json = JSON.stringify(message);

        for (const [minerId, miner] of this.miners) {
            try {
                miner.ws.send(json);
            } catch (error) {
                console.error(`[Error] Failed to broadcast to ${minerId}:`, error);
            }
        }
    }

    setDifficulty(newDifficulty) {
        this.difficulty = newDifficulty;
        this.currentJob = new MiningJob(this.difficulty);

        console.log(`\n[Difficulty] Changed to ${this.difficulty}`);
        this.broadcast('mining.notify', this.getJobParams());
        this.broadcast('mining.set_difficulty', [this.difficulty]);
    }

    printStats() {
        const uptime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(1);

        console.log('\n===== Statistics =====');
        console.log(`Uptime: ${uptime} minutes`);
        console.log(`Connected miners: ${this.miners.size}`);
        console.log(`Total shares: ${this.stats.shares} (A: ${this.stats.accepted}, R: ${this.stats.rejected})`);
        console.log(`Blocks found: ${this.stats.blocksFound}`);
        console.log(`Accept rate: ${this.stats.shares > 0 ? ((this.stats.accepted / this.stats.shares * 100).toFixed(1)) : 0}%`);
        console.log('=====================\n');

        // Per-miner stats
        if (this.miners.size > 0) {
            console.log('Miner Statistics:');
            for (const [id, miner] of this.miners) {
                const minerUptime = ((Date.now() - miner.stats.connectTime) / 1000 / 60).toFixed(1);
                console.log(`  ${miner.username || 'N/A'}@${miner.worker || 'N/A'}: ${miner.stats.shares} shares, ${minerUptime}m`);
            }
        }
    }

    getStats() {
        return {
            port: this.port,
            difficulty: this.difficulty,
            uptime: ((Date.now() - this.stats.startTime) / 1000),
            connections: this.stats.connections,
            connectedMiners: this.miners.size,
            totalShares: this.stats.shares,
            acceptedShares: this.stats.accepted,
            rejectedShares: this.stats.rejected,
            blocksFound: this.stats.blocksFound,
            currentJob: this.currentJob ? {
                id: this.currentJob.id,
                difficulty: this.currentJob.difficulty
            } : null,
            miners: Array.from(this.miners.values()).map(m => ({
                id: m.id,
                username: m.username,
                worker: m.worker,
                authorized: m.authorized,
                subscribed: m.subscribed,
                shares: m.stats.shares,
                accepted: m.stats.accepted,
                rejected: m.stats.rejected,
                uptime: (Date.now() - m.stats.connectTime) / 1000
            }))
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const port = parseInt(args[0]) || 8080;
    const difficulty = parseInt(args[1]) || 1000;

    console.log('========================================');
    console.log('  YespowerTidecoin Mining Pool');
    console.log('  WebSocket Server for Testing');
    console.log('========================================');
    console.log('');

    const server = new MiningPoolServer({ port, difficulty });
    server.start();

    console.log('Commands:');
    console.log('  Press Ctrl+C to stop');
    console.log('');

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n[Shutdown] Stopping server...');
        server.printStats();
        process.exit(0);
    });

    // Simple CLI commands
    process.stdin.setRawMode(true);
    process.stdin.on('data', (key) => {
        const cmd = key.toString().toLowerCase();

        if (cmd === 'q' || cmd === '\u0003') { // q or Ctrl+C
            process.emit('SIGINT');
        } else if (cmd === 's') {
            server.printStats();
        } else if (cmd === 'd') {
            const newDiff = Math.floor(Math.random() * 5000) + 500;
            server.setDifficulty(newDiff);
        } else if (cmd === '?') {
            console.log('\nCommands:');
            console.log('  s - Show statistics');
            console.log('  d - Randomize difficulty');
            console.log('  q - Quit');
            console.log('');
        }
    });
}

module.exports = MiningPoolServer;
