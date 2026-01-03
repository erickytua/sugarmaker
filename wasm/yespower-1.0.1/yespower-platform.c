/*-
 * Copyright 2013-2018 Alexander Peslyak
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

/*-
 * Simplified yespower platform code for WASM
 * Uses standard malloc/free instead of platform-specific memory allocation.
 */

#include <stdlib.h>
#include <string.h>
#include <errno.h>

#define HUGEPAGE_THRESHOLD		(12 * 1024 * 1024)

static void *alloc_region(yespower_region_t *region, size_t size)
{
	size_t base_size = size;
	uint8_t *base, *aligned;

	/* Simple allocation for WASM - no mmap/hugepages */
	base = malloc(size + 63);
	if (base != NULL) {
		aligned = base + 63;
		aligned -= (size_t)aligned & 63;
	} else {
		base = aligned = NULL;
	}

	region->base = base;
	region->aligned = aligned;
	region->base_size = base ? size + 63 : 0;
	region->aligned_size = base ? size : 0;
	return aligned;
}

static inline void init_region(yespower_region_t *region)
{
	region->base = region->aligned = NULL;
	region->base_size = region->aligned_size = 0;
}

static int free_region(yespower_region_t *region)
{
	if (region->base) {
		free(region->base);
	}
	init_region(region);
	return 0;
}
