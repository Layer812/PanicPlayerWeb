/* PanicPlayerWeb: Layer812-authored experimental C ABI to separately pinned
 * BSD-3-Clause ymfm YM2151, which is NOT bundled in this repository.
 * This wrapper contains no upstream ymfm code. SPDX-License-Identifier: MIT.
 */
#ifndef PWP_YM2151_BRIDGE_H
#define PWP_YM2151_BRIDGE_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
void pwp_ym2151_reset(void);
void pwp_ym2151_write(uint8_t reg,uint8_t data);
void pwp_ym2151_advance(uint32_t cycles);
uint32_t pwp_ym2151_pending(void);
uint32_t pwp_ym2151_pop(void);
uint32_t pwp_ym2151_sample_rate(void);
uint32_t pwp_ym2151_overflows(void);
void pwp_ym2151_discard(void);
#ifdef __cplusplus
}
#endif
#endif
