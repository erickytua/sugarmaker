/*
 * WASM Wrapper for YespowerTidecoin Algorithm
 *
 * This file provides a JavaScript-accessible interface for the YespowerTidecoin
 * hashing algorithm. It exposes functions that can be called from JavaScript/Node.js
 * to perform hash computations on block data.
 *
 * Exported Functions:
 * - scan_tidecoin_hash(blockData, target, maxNonce, startNonce): Performs hash scanning
 * - get_version(): Returns the module version string
 */

#include <emscripten.h>
#include "miner.h"
#include "yespower.h"
#include <stdlib.h>
#include <string.h>

/* Buffer for block header data (80 bytes = 20 * 32-bit words) */
static uint32_t block_data[20];
static uint32_t target_data[8];
static unsigned long hashes_done = 0;

/**
 * scan_tidecoin_hash
 *
 * Scans for a valid nonce that produces a hash below the target.
 *
 * Parameters (passed via emscripten heap):
 * - block_data_ptr: Pointer to 80-byte block header data (little-endian)
 * - target_ptr: Pointer to 32-byte target (little-endian)
 * - start_nonce: Starting nonce value (32-bit)
 * - max_nonce: Maximum nonce value to scan (32-bit)
 *
 * Returns: 1 if valid hash found, 0 otherwise
 *
 * If successful, block_data[19] will contain the found nonce,
 * and the hash can be computed separately.
 */
EMSCRIPTEN_KEEPALIVE
int scan_tidecoin_hash(uint8_t *block_data_ptr, uint8_t *target_ptr,
                        uint32_t start_nonce, uint32_t max_nonce)
{
    int i;
    static const yespower_params_t params = {
        .version = YESPOWER_1_0,
        .N = 2048,
        .r = 8,
        .pers = NULL,
        .perslen = 0
    };

    union {
        uint8_t u8[80];
        uint32_t u32[20];
    } data;
    union {
        yespower_binary_t yb;
        uint32_t u32[8];
    } hash;

    uint32_t n = start_nonce - 1;
    const uint32_t Htarg = ((uint32_t*)target_ptr)[7];

    /* Copy block data and convert to host byte order if needed */
    memcpy(data.u8, block_data_ptr, 80);

    /* Ensure proper byte order for 32-bit words */
    for (i = 0; i < 19; i++) {
        data.u32[i] = le32dec(&block_data_ptr[i * 4]);
    }

    /* Scan for valid nonce */
    do {
        be32enc(&data.u32[19], ++n);

        if (yespower_tls(data.u8, 80, &params, &hash.yb))
            return -1; /* Error */

        if (le32dec(&hash.u32[7]) <= Htarg) {
            for (i = 0; i < 8; i++)
                hash.u32[i] = le32dec(&hash.u32[i]);

            if (fulltest(hash.u32, (uint32_t*)target_ptr)) {
                hashes_done = n - start_nonce + 1;
                /* Store the found nonce back in the block data */
                le32enc(&block_data_ptr[19 * 4], n);
                return 1;
            }
        }
    } while (n < max_nonce);

    hashes_done = n - start_nonce + 1;
    return 0;
}

/**
 * compute_single_hash
 *
 * Computes a single YespowerTidecoin hash for given block data.
 *
 * Parameters:
 * - block_data_ptr: Pointer to 80-byte block header data
 * - hash_output_ptr: Pointer to 32-byte buffer for output hash
 *
 * Returns: 0 on success, -1 on error
 */
EMSCRIPTEN_KEEPALIVE
int compute_single_hash(uint8_t *block_data_ptr, uint8_t *hash_output_ptr)
{
    static const yespower_params_t params = {
        .version = YESPOWER_1_0,
        .N = 2048,
        .r = 8,
        .pers = NULL,
        .perslen = 0
    };

    union {
        yespower_binary_t yb;
        uint32_t u32[8];
    } hash;

    /* Compute hash */
    if (yespower_tls(block_data_ptr, 80, &params, &hash.yb))
        return -1;

    /* Copy result to output (already in little-endian format from yespower) */
    memcpy(hash_output_ptr, hash.yb.uc, 32);

    return 0;
}

/**
 * get_hashes_done
 *
 * Returns the number of hashes computed in the last scan_tidecoin_hash call.
 */
EMSCRIPTEN_KEEPALIVE
unsigned long get_hashes_done(void)
{
    return hashes_done;
}

/**
 * get_algorithm_params
 *
 * Returns the Yespower parameters used for Tidecoin.
 * Returns a struct with: version (int), N (int), r (int)
 */
EMSCRIPTEN_KEEPALIVE
void get_algorithm_params(int *version, int *N, int *r)
{
    *version = YESPOWER_1_0;
    *N = 2048;
    *r = 8;
}

/**
 * get_version
 *
 * Returns the version string of the WASM module.
 */
EMSCRIPTEN_KEEPALIVE
const char* get_version(void)
{
    return "sugarmaker-wasm 1.0.0";
}

/**
 * get_hash_size
 *
 * Returns the size of the hash output in bytes.
 */
EMSCRIPTEN_KEEPALIVE
int get_hash_size(void)
{
    return 32;
}

/**
 * get_block_size
 *
 * Returns the expected block header size in bytes.
 */
EMSCRIPTEN_KEEPALIVE
int get_block_size(void)
{
    return 80;
}
