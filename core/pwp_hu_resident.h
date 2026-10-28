/* Human68k HU relocatable image staging for future genuine Z-MUSIC TSR boot.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT (original glue).
 * Does not claim Z-MUSIC is resident; does not execute a driver.
 */
#ifndef PWP_HU_RESIDENT_H
#define PWP_HU_RESIDENT_H
#include <stddef.h>
#include <stdint.h>
typedef struct {
    uint32_t load_address, entry_address, end_address;
    uint32_t text_size, data_size, bss_size, relocation_count;
} pwp_hu_image;
/* Relocate HU .X payload into a guest-owned RAM window. All bounds and
 * relocation targets are verified before touching the destination. Returns
 * 1 on success and 0 otherwise; output is unchanged on validation failure.
 * Caller must provide a disjoint src and dst and hold memory ownership. */
int pwp_hu_stage(const uint8_t *file, size_t length, uint8_t *dst,
                 size_t capacity, uint32_t load_address, pwp_hu_image *info);
/* Examine the ACTUAL guest vector and signature. Does not create TSR markers.
 * 1: Z-MUSIC v2 signature and handler in supplied RAM, 0: not installed. */
int pwp_zm2_guest_resident(const uint8_t *ram, size_t length);
#endif
