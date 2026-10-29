/* Panic Player Web R7: faithful bounded VIDEO register/TVRAM subset.
 * No WebX68k code. Other hardware remains unsupported, not silently stubbed.
 */
#ifndef PWP_X68K_VIDEO_BUS_H
#define PWP_X68K_VIDEO_BUS_H
#include <stdint.h>
void pwp_bus_reset(void);
/* CRTMOD mode 10 device-effects subset; NO framebuffer display enable. */
int pwp_bus_apply_crtmod10(void);
/* IOCS _G_CLR_ON graphics initialisation, supported only after CRTMOD 10.
 * Clear & display setup are NOT decoded PAN frame mutations. */
int pwp_bus_g_clr_on10(void);
/* R16 FIX12: IOCS $C0/$C1 sprite/BG hardware subset (mode 10 only).
 * Sprite initialization clears sprite attributes, BG scroll/control, PCG/BG
 * patterns and sprite palettes; it never counts as decoded movie pixels.
 * No sprite compositing, scan timing or animation success is claimed. */
int pwp_bus_sp_init10(void);
int pwp_bus_sp_on10(void);
int pwp_bus_sp_off10(void);
/* Distinguish an IOCS SON request from CYNTHIA DISP and the actual
 * guest-provided sprite/PCG/palette data. Read-only diagnostics. */
uint32_t pwp_bus_cynthia_disp_gate(void);
uint32_t pwp_bus_cynthia_raw_sprite_count(void);
uint32_t pwp_bus_cynthia_attr_writes(void);
uint32_t pwp_bus_cynthia_pcg_writes(void);
uint32_t pwp_bus_cynthia_palette_writes(void);
uint32_t pwp_bus_sprite_initialized(void);
uint32_t pwp_bus_sprite_display_enabled(void);
uint32_t pwp_bus_sprite_initializations(void);
uint32_t pwp_bus_sprite_enables(void);
/* FIX34: index-domain CYNTHIA sprite/BG scanout using guest hardware backing.
 * out receives zero for transparency, otherwise the guest TEXT/BG palette index.
 * No synthetic movie pixels and no guest MMIO mutations. */
void pwp_bus_cynthia_line(uint32_t y,uint32_t width,uint8_t *out);
uint32_t pwp_bus_cynthia_active_sprites(void);
uint32_t pwp_bus_graphics_display_enabled(void);
uint32_t pwp_bus_graphics_clear_count(void);
uint32_t pwp_bus_graphics_page(void);
/* FIX40 DMA3 register diagnostics: no transfer/audio success implied. */
uint32_t pwp_bus_dmac3_csr_reads(void);
uint32_t pwp_bus_dmac3_write_count(void);
uint32_t pwp_bus_dmac3_start_rejections(void);
#ifdef PWP_TEST_STAGE
void pwp_bus_test_dmac3_status(uint8_t csr,uint8_t cer);
#endif
/* FIX42: guest-clocked direct sound-register observation. No FM or DMA audio is fabricated. */
void pwp_bus_audio_advance_cycles(uint32_t cycles);
/* FIX43: validated DMA3 device-clock transfers, audible FIFO and evidence. */
int pwp_bus_dma3_step(uint32_t cycles,const uint8_t *ram,uint32_t ram_size);
uint32_t pwp_bus_dma3_fault_address(void);
uint32_t pwp_bus_dma3_bytes_sent(void);
uint32_t pwp_bus_dma3_completions(void);
uint32_t pwp_bus_dma3_register(uint32_t offset);
int32_t pwp_bus_sound_pop(void);
uint32_t pwp_bus_sound_bytes(void);
uint32_t pwp_bus_sound_overflows(void);
uint32_t pwp_bus_opm_busy_cycles(void);
uint32_t pwp_bus_opm_status_reads(void);
uint32_t pwp_bus_opm_ct_writes(void);
uint32_t pwp_bus_adpcm_playing(void);
uint32_t pwp_bus_pia_port_c(void);
uint32_t pwp_bus_adpcm_control_writes(void);
/* FIX41: read-only evidence of actual guest system/OPM port traffic. */
uint32_t pwp_bus_sysport_contrast_writes(void);
uint32_t pwp_bus_opm_latch(void);
#ifdef PWP_EXPERIMENTAL_ZM2
uint32_t pwp_bus_opm_register_writes(void);
uint32_t pwp_bus_opm_keyons(void);
uint32_t pwp_bus_opm_timer_commands(void);
uint32_t pwp_bus_opm_register(uint32_t index);
#endif
uint32_t pwp_bus_opm_address_writes(void);
uint32_t pwp_bus_opm_data_rejections(void);
int pwp_bus_access8(uint32_t address);
/* Writeability preflight avoids half-committed multi-byte MMIO writes. */
int pwp_bus_writable8(uint32_t address);
int pwp_bus_read8(uint32_t address, uint8_t *value);
int pwp_bus_write8(uint32_t address, uint8_t value);
/* FIX33: physical system port #4 last written control bits (host test). */
uint32_t pwp_bus_sysport4_control(void);
uint16_t pwp_bus_graphic_word(uint32_t x,uint32_t y);
uint8_t pwp_bus_text_index(uint32_t x, uint32_t y);
uint16_t pwp_bus_palette_word(uint32_t index, int text_palette);
uint32_t pwp_bus_video_writes(void);
uint32_t pwp_bus_pixel_mutations(void);
uint8_t pwp_bus_crtc_register(uint32_t reg);
/* FIX15: bounded read-only observation of guest-programmed raster registers. */
uint32_t pwp_bus_crtc_changed_writes(void);
uint32_t pwp_bus_vctrl_r2(void);
uint32_t pwp_bus_vctrl_r1(void);
/* R16 FIX5 narrow, evidence-backed MFP interrupt-control register subset. */
/* FIX20: real MC68901 GPIP4 V-DISP source is enabled only when
 * BOTH IERB B6 and IMRB B6 are set by guest code. No other
 * interrupt source is synthesized. */
uint32_t pwp_bus_mfp_vdisp_enabled(void);
/* V-DISP source 6 latched pending/acknowledge, matching MC68901 IPRB6.
 * Unlike the old edge-only model, unmasking a pending enabled source can
 * deliver the interrupt.  No other timer/serial/MFP source is emulated. */
void pwp_bus_mfp_vdisp_pulse(void);
uint32_t pwp_bus_mfp_vdisp_irq_ready(void);
void pwp_bus_mfp_vdisp_ack(void);
#ifdef PWP_EXPERIMENTAL_ZM2
/* Real YM2151 status IRQ falling edge on MC68901 GPIP3 / vector $43. */
uint32_t pwp_bus_mfp_opm_irq_ready(void);
void pwp_bus_mfp_opm_ack(void);
#endif
uint32_t pwp_bus_mfp_vdisp_latched(void);
/* GPIP4 is an external CRTC V-DISP input, not a software movie flag.
 * Read $E88001: bit 4 high in display, low in vertical blank.
 * The 68000 clock scheduler updates it at the raster phase boundary. */
void pwp_bus_mfp_set_vdisp_active(int active);
uint32_t pwp_bus_mfp_gpip4_reads(void);
uint32_t pwp_bus_mfp_gpip4_level(void);
uint32_t pwp_bus_mfp_ierb_reads(void);
uint32_t pwp_bus_mfp_imrb_reads(void);
uint32_t pwp_bus_mfp_last_read_address(void);
#endif
