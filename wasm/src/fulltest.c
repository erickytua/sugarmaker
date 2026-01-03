/*
 * Minimal fulltest function extracted from util.c
 * Used for hash validation in YespowerTidecoin algorithm
 */

#include "miner.h"
#include <string.h>

bool fulltest(const uint32_t *hash, const uint32_t *target)
{
	int i;
	bool rc = true;

	for (i = 7; i >= 0; i--) {
		if (hash[i] > target[i]) {
			rc = false;
			break;
		}
		if (hash[i] < target[i]) {
			rc = true;
			break;
		}
	}

	return rc;
}
