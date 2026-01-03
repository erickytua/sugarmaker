/**
 * Example Node.js script for testing the YespowerTidecoin WASM module
 *
 * This script demonstrates how to:
 * 1. Load the WASM module
 * 2. Compute a single hash
 * 3. Scan for a valid nonce
 */

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

// Helper function to convert hex string to 32-bit little-endian words
function hexToUint32Array(hex) {
    const bytes = hexToBytes(hex);
    const words = new Uint32Array(bytes.length / 4);
    const dataView = new DataView(words.buffer);
    for (let i = 0; i < bytes.length; i++) {
        dataView.setUint8(i, bytes[i]);
    }
    return words;
}

// Print module information
console.log('=== YespowerTidecoin WASM Module ===');
console.log('Version:', yespower._get_version());
console.log('Hash size:', yespower._get_hash_size(), 'bytes');
console.log('Block size:', yespower._get_block_size(), 'bytes');

const params = new Int32Array(3);
yespower._get_algorithm_params(
    params.byteOffset,
    params.byteOffset + 4,
    params.byteOffset + 8
);
console.log('Algorithm params:', {
    version: params[0],
    N: params[1],
    r: params[2]
});
console.log('');

// Example 1: Compute a single hash
console.log('=== Example 1: Single Hash Computation ===');
const exampleBlockHeader = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c';

function computeSingleHash(blockDataHex) {
    const blockPtr = yespower._malloc(80);
    const hashPtr = yespower._malloc(32);

    try {
        // Convert hex to bytes
        const blockBytes = hexToBytes(blockDataHex.padEnd(160, '0'));

        // Copy block data to WASM memory
        for (let i = 0; i < Math.min(blockBytes.length, 80); i++) {
            yespower.setValue(blockPtr + i, blockBytes[i], 'i8');
        }

        // Compute hash
        const startTime = Date.now();
        const result = yespower._compute_single_hash(blockPtr, hashPtr);
        const elapsed = Date.now() - startTime;

        if (result !== 0) {
            throw new Error('Hash computation failed');
        }

        // Read the hash result
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            hash[i] = yespower.getValue(hashPtr + i, 'i8');
        }

        return { hash: bytesToHex(hash), elapsed };
    } finally {
        yespower._free(blockPtr);
        yespower._free(hashPtr);
    }
}

try {
    const { hash, elapsed } = computeSingleHash(exampleBlockHeader);
    console.log('Block header:', exampleBlockHeader.substring(0, 64) + '...');
    console.log('Hash:', hash);
    console.log('Computation time:', elapsed, 'ms');
} catch (error) {
    console.error('Error:', error.message);
}

console.log('');

// Example 2: Scan for a valid nonce (simplified example)
console.log('=== Example 2: Nonce Scanning ===');

function scanForNonce(blockDataWords, targetWords, startNonce, maxNonce) {
    const blockPtr = yespower._malloc(80);
    const targetPtr = yespower._malloc(32);

    try {
        // Copy block data (as 32-bit words)
        for (let i = 0; i < 20; i++) {
            yespower.setValue(blockPtr + (i * 4), blockDataWords[i], 'i32');
        }

        // Copy target (as 32-bit words)
        for (let i = 0; i < 8; i++) {
            yespower.setValue(targetPtr + (i * 4), targetWords[i], 'i32');
        }

        // Scan for nonce
        const startTime = Date.now();
        const found = yespower._scan_tidecoin_hash(
            blockPtr, targetPtr, startNonce, maxNonce
        );
        const elapsed = Date.now() - startTime;

        if (found === 1) {
            // Read the found nonce
            const foundNonce = yespower.getValue(blockPtr + 76, 'i32');
            const hashesDone = yespower._get_hashes_done();
            return {
                found: true,
                nonce: foundNonce,
                hashesDone,
                elapsed,
                hashesPerSecond: Math.round(hashesDone * 1000 / elapsed)
            };
        } else if (found === 0) {
            return {
                found: false,
                hashesDone: yespower._get_hashes_done(),
                elapsed
            };
        } else {
            return { found: false, error: true };
        }
    } finally {
        yespower._free(blockPtr);
        yespower._free(targetPtr);
    }
}

// Create example block data (simplified, not a real block)
const exampleBlock = new Uint32Array(20);
exampleBlock[0] = 0x01000000; // Version
// Fill rest with zeros except nonce
exampleBlock[19] = 0; // Start nonce

// Create a very easy target for demonstration
// (this would normally be derived from network difficulty)
const easyTarget = new Uint32Array(8);
easyTarget[0] = 0x0000ffff; // Very low difficulty
easyTarget[1] = 0xffffffff;
easyTarget[2] = 0xffffffff;
easyTarget[3] = 0xffffffff;
easyTarget[4] = 0xffffffff;
easyTarget[5] = 0xffffffff;
easyTarget[6] = 0xffffffff;
easyTarget[7] = 0xffffffff;

console.log('Scanning for nonce with easy target...');
console.log('Start nonce:', 0);
console.log('Max nonce:', 10000);

try {
    const result = scanForNonce(exampleBlock, easyTarget, 0, 10000);
    console.log('Result:', result);

    if (result.found) {
        console.log('✓ Found valid nonce:', result.nonce);
        console.log('Hashes computed:', result.hashesDone);
        console.log('Hash rate:', result.hashesPerSecond, 'H/s');
    } else {
        console.log('No valid nonce found in range');
        console.log('Hashes computed:', result.hashesDone);
    }
} catch (error) {
    console.error('Error:', error.message);
}

console.log('');
console.log('=== Example Complete ===');
