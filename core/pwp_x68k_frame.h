/* Panic Player Web R8: bounded frame conversion from emulated guest VRAM.
 * This is a partial GRAPHICS/TEXT renderer, NOT a PANIC frame compositor.
 * Caller must not claim complete sprites/BG/CRTC timing support.
 * New glue: MIT. No WebX68k dependencies.
 */
#ifndef PWP_X68K_FRAME_H
#define PWP_X68K_FRAME_H
#include <stdint.h>
#include <stddef.h>
/* Always opaque RGBA, row-major, contiguous, 512x512 maximum. */
int pwp_frame_render(uint32_t width, uint32_t height,
                     uint32_t graphic_page, uint32_t overlay_text);
/* R16 FIX17: bounded graphics-layer composite for 256-colour mode 10.
 * R2 bits 0-3 enable PRIORITY SLOTS, not physical pages. R1 pairs map
 * slot -> page. This is graphics (+optional text) evidence only: sprite/BG,
 * special blending and full layer priority are NOT modeled. */
int pwp_frame_render_mode10(uint32_t width,uint32_t height,uint32_t overlay_text);
uintptr_t pwp_frame_pointer(void);
uint32_t pwp_frame_size(void);
/* FIX36 last-rendered frame's observed layer contributions. */
uint32_t pwp_frame_gfx_nonzero(void);
uint32_t pwp_frame_text_nonzero(void);
uint32_t pwp_frame_gfx_text_overlap(void);
uint32_t pwp_frame_gfx_palette_zero(void);
uint32_t pwp_frame_gfx_visible_pixels(void);
uint32_t pwp_frame_text_visible_pixels(void);
/* Converts original 5+5+5+intensity X68000 GRB color value to RGBA8888. */
uint32_t pwp_frame_grb8888(uint16_t guest_color);
/* FIX27: display-only palette-0 evidence; never writes guest MMIO. */
void pwp_frame_set_palette0_evidence(uint32_t enable,uint32_t word);
#endif
