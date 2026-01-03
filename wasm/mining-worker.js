/**
 * Web Worker for YespowerTidecoin Mining
 *
 * This worker performs mining operations in a separate thread
 * to prevent UI blocking in the browser.
 */

importScripts('./dist/yespower-tidecoin.js');

let Module = null;
let isMining = false;
let currentJob = null;
let currentNonce = 0;
let stats = {
    hashes: 0,
    startTime: 0
};

// Initialize WASM module
Module().then(mod => {
    Module = mod;
    self.postMessage({ type: 'initialized', version: Module._get_version() });
}).catch(error => {
    self.postMessage({ type: 'error', message: error.message });
});

// Handle messages from main thread
self.onmessage = function(event) {
    const { type, data } = event.data;

    switch (type) {
        case 'start':
            startMining(data);
            break;

        case 'stop':
            stopMining();
            break;

        case 'newJob':
            setJob(data);
            break;

        case 'getStats':
            sendStats();
            break;

        default:
            console.warn('[Worker] Unknown message type:', type);
            break;
    }
};

function startMining(job) {
    if (!Module) {
        self.postMessage({ type: 'error', message: 'WASM module not initialized' });
        return;
    }

    setJob(job);
    isMining = true;
    stats.hashes = 0;
    stats.startTime = Date.now();

    self.postMessage({ type: 'miningStarted' });

    // Start mining loop
    mineLoop();
}

function stopMining() {
    isMining = false;
    self.postMessage({ type: 'miningStopped' });
}

function setJob(job) {
    currentJob = job;
    currentNonce = 0;
}

function mineLoop() {
    if (!isMining || !currentJob) {
        requestAnimationFrame(mineLoop);
        return;
    }

    try {
        // Prepare block header
        const blockHeader = prepareBlockHeader(currentJob, currentNonce);

        // Compute hash
        const hashResult = computeHash(blockHeader);

        if (hashResult) {
            stats.hashes++;

            // Check if hash meets difficulty
            if (meetsDifficulty(hashResult, currentJob.difficulty)) {
                // Submit share
                self.postMessage({
                    type: 'share',
                    data: {
                        nonce: currentNonce,
                        hash: hashResult,
                        jobId: currentJob.id
                    }
                });
            }
        }

        // Update nonce
        currentNonce++;

        // Send stats periodically
        if (stats.hashes % 100 === 0) {
            sendStats();
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: `Mining error: ${error.message}`
        });
        return;
    }

    requestAnimationFrame(mineLoop);
}

function prepareBlockHeader(job, nonce) {
    // Simplified block header preparation
    const header = new Uint8Array(80);

    // Version (4 bytes, little-endian)
    const versionBytes = hexToBytes(job.version.padStart(8, '0'));
    for (let i = 0; i < 4; i++) {
        header[i] = versionBytes[i];
    }

    // Previous hash (32 bytes)
    const prevHashBytes = hexToBytes(job.prevHash);
    for (let i = 0; i < 32; i++) {
        header[4 + i] = prevHashBytes[i];
    }

    // Merkle root (32 bytes) - simplified
    for (let i = 0; i < 32; i++) {
        header[36 + i] = 0; // Would be computed from merkle branch
    }

    // Time (4 bytes)
    const timeBytes = hexToBytes(job.time.padStart(8, '0'));
    for (let i = 0; i < 4; i++) {
        header[68 + i] = timeBytes[i];
    }

    // Bits (4 bytes)
    const bitsBytes = hexToBytes(job.bits.padStart(8, '0'));
    for (let i = 0; i < 4; i++) {
        header[72 + i] = bitsBytes[i];
    }

    // Nonce (4 bytes)
    header[76] = nonce & 0xff;
    header[77] = (nonce >> 8) & 0xff;
    header[78] = (nonce >> 16) & 0xff;
    header[79] = (nonce >> 24) & 0xff;

    return header;
}

function computeHash(blockHeader) {
    const blockPtr = Module._malloc(80);
    const hashPtr = Module._malloc(32);

    try {
        // Copy block header to WASM memory
        for (let i = 0; i < 80; i++) {
            Module.setValue(blockPtr + i, blockHeader[i], 'i8');
        }

        // Compute hash
        const result = Module._compute_single_hash(blockPtr, hashPtr);

        if (result !== 0) {
            return null;
        }

        // Read hash result
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            hash[i] = Module.getValue(hashPtr + i, 'i8');
        }

        return hash;
    } finally {
        Module._free(blockPtr);
        Module._free(hashPtr);
    }
}

function meetsDifficulty(hash, difficulty) {
    // Simplified difficulty check
    const difficultyValue = parseInt(difficulty, 16);
    const hashValue = (hash[0] << 16) | (hash[1] << 8) | hash[2];

    return hashValue < difficultyValue;
}

function sendStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const hashRate = elapsed > 0 ? Math.round(stats.hashes / elapsed) : 0;

    self.postMessage({
        type: 'stats',
        data: {
            hashes: stats.hashes,
            hashRate: hashRate,
            elapsed: elapsed,
            currentNonce: currentNonce
        }
    });
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
