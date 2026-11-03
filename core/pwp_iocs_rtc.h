/* Clock Cat RTC support for the genuine X68000 IOCS ABI.
 * Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
 * Browser WASM libc time()/localtime() supplies the browser machine's
 * current local civil time. The guest still executes TRAP #15 itself.
 */
#ifndef PWP_IOCS_RTC_H
#define PWP_IOCS_RTC_H
#include <stdint.h>
#include <time.h>

static inline uint32_t pwp_iocs_bcd8(uint32_t v) {
  return ((v / 10u) << 4) | (v % 10u);
}
static inline uint32_t pwp_iocs_unbcd8(uint32_t v) {
  return ((v >> 4) * 10u) + (v & 15u);
}
static inline int pwp_iocs_bcd8_valid(uint32_t v) {
  return ((v & 15u) <= 9u) && ((v >> 4) <= 9u);
}
/* IOCS _TIMEGET returns $00hhmmss packed BCD. */
static inline uint32_t pwp_iocs_time_bcd(uint32_t hour, uint32_t min, uint32_t sec) {
  return (pwp_iocs_bcd8(hour) << 16) | (pwp_iocs_bcd8(min) << 8) | pwp_iocs_bcd8(sec);
}
/* IOCS _TIMEBIN accepts D1.L BCD, returns $00hhmmss binary. */
static inline int pwp_iocs_time_bcd_valid(uint32_t bcd) {
  const uint32_t h=(bcd >> 16)&255u, m=(bcd >> 8)&255u, s=bcd&255u;
  return (bcd >> 24)==0u &&
    pwp_iocs_bcd8_valid(h) && pwp_iocs_bcd8_valid(m) && pwp_iocs_bcd8_valid(s) &&
    pwp_iocs_unbcd8(h)<24u && pwp_iocs_unbcd8(m)<60u && pwp_iocs_unbcd8(s)<60u;
}
static inline uint32_t pwp_iocs_time_bin(uint32_t bcd) {
  return (pwp_iocs_unbcd8((bcd>>16)&255u)<<16) |
         (pwp_iocs_unbcd8((bcd>>8)&255u)<<8) |
         pwp_iocs_unbcd8(bcd&255u);
}
/* IOCS _DATEGET returns $0wYYMMDD in BCD, weekday 0=Sunday. */
static inline uint32_t pwp_iocs_date_bcd(uint32_t year, uint32_t month,
                                          uint32_t day, uint32_t weekday) {
  return ((weekday&15u)<<24) | (pwp_iocs_bcd8(year%100u)<<16) |
         (pwp_iocs_bcd8(month)<<8) | pwp_iocs_bcd8(day);
}
#endif
