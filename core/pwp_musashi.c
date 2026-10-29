/* Panic Player Web R9: Musashi ABI adapter / bounded video bus + DOS.
 * Copyright 2026, new glue code only; MIT.
 * Musashi source is NOT bundled. See BUILD_R5_MUSASHI.py for exact source pin.
 * This is a CPU/bootstrap adapter, NOT a playable PANIC runtime.
 */
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include "m68k.h"
#include "pwp_x68k_video_bus.h"
#ifdef PWP_EXPERIMENTAL_ZM2
#include "pwp_hu_resident.h"
#endif

#define PWP_RAM_BYTES (4u * 1024u * 1024u)
#define PWP_HU_CAP (1024u * 1024u)
#define PWP_LOAD 0x10000u
#define PWP_MCB (PWP_LOAD - 16u)
/* Human68k startup A2: LASCII command line (length, bytes, trailing NUL).
 * Keep it outside the program image, memory-control header and vectors.
 * Matches the proven Tab5 guest batch's PAN file argument. */
#define PWP_CMDLINE 0x00008000u
static const char pwp_command_line[] = "C:\\P68K.PAN";
#define PWP_LIMIT 0x3f0000u

/* FIX20: PANIC.X itself writes vector $46 at 0x000118, then executes
 * BSET #6,$E88009 (IERB) and BSET #6,$E88015 (IMRB).
 * Without an MFP level-6 vectored interrupt, its guest frame-ready flag
 * is never updated; repainting Canvas cannot fix that.
 * Only this observed V-DISP path is supported, not a blanket autovector. */
static uint8_t ram[PWP_RAM_BYTES];
#define PWP_X68K_CPU_HZ 16000000ull
#define PWP_VDISP_CYCLES ((PWP_X68K_CPU_HZ+30ull)/60ull)
/* Display active for the first 90% of the modeled scan-frame, then vertical
 * blank for the final 10%. This is a coarse scan timing approximation.
 * Both GPIP4 and IRQ share this exact modeled falling edge. A future
 * cycle-accurate CRTC must derive both boundaries from actual CRTC totals. */
#define PWP_ACTIVE_CYCLES (PWP_VDISP_CYCLES*9ull/10ull)
static uint64_t pwp_guest_cycles, pwp_next_vdisp, pwp_next_scanout;
static uint32_t pwp_vdisp_ticks, pwp_vdisp_acks, pwp_scanout_ticks;
static int pwp_vdisp_pending;
#ifdef PWP_TAB5_MUSASHI
int my_irqh_callback(int level) {
  if (level == 6 && pwp_bus_mfp_vdisp_irq_ready()) {
    pwp_bus_mfp_vdisp_ack();
    pwp_vdisp_pending = 0;
    pwp_vdisp_acks++;
    return 0x46; /* MC68901 GPIP4, default X68000 vector base $40 */
  }
  return -1; /* Others retain Musashi's autovector fallback. */
}
#endif
static void pwp_advance_vdisp(uint32_t elapsed) {
  pwp_guest_cycles += elapsed;
  while (pwp_guest_cycles >= pwp_next_vdisp) {
    pwp_next_vdisp += PWP_VDISP_CYCLES;
    pwp_vdisp_ticks++;
    /* Interrupt source must have been enabled by the GUEST and its
     * ISR installed at vector $46. Never invoke a host substitute ISR. */
    /* Actual MFP IPRB latches the V-DISP event even if IMRB masks it.
     * Delivery occurs when guest later unmasks, not only on this edge. */
    pwp_bus_mfp_vdisp_pulse();
  }
  /* FIX23: The screen is sampled at the START of the NEXT visible interval,
   * not upon entry to blanking. The guest V-DISP ISR must have time to run
   * between those edges; sampling at the falling edge observes stale R2.
   * This is a distinct guest raster edge, never a fabricated PAN frame. */
  while (pwp_guest_cycles >= pwp_next_scanout) {
    pwp_next_scanout += PWP_VDISP_CYCLES;
    ++pwp_scanout_ticks;
  }
  /* The signal remains high during visible scanout and falls at the same
   * emulated event which can request the GPIP4 interrupt. Polling the
   * $E88001 bit observes actual virtual CRTC phase, never a fake frame. */
  pwp_bus_mfp_set_vdisp_active((pwp_guest_cycles % PWP_VDISP_CYCLES) < PWP_ACTIVE_CYCLES);
}
uint32_t pwp_mu_vdisp_ticks(void) {return pwp_vdisp_ticks;}
uint32_t pwp_mu_scanout_ticks(void) {return pwp_scanout_ticks;}
uint32_t pwp_mu_vdisp_acks(void) {return pwp_vdisp_acks;}
uint32_t pwp_mu_vdisp_pending(void) {return (uint32_t)pwp_vdisp_pending;}
uint32_t pwp_mu_vdisp_latched(void) {return pwp_bus_mfp_vdisp_latched();}
uint32_t pwp_mu_gpip_reads(void){return pwp_bus_mfp_gpip4_reads();}
uint32_t pwp_mu_gpip_level(void){return pwp_bus_mfp_gpip4_level();}
uint32_t pwp_mu_guest_cycles(void) {return (uint32_t)pwp_guest_cycles;}
/* Unit-test-only raster clock injection: never compiled into real Musashi
 * exports, browser WASM or user runtime. This does not execute 68000 code. */
#ifdef PWP_TEST_STAGE
void pwp_mu_test_advance_cycles(uint32_t delta) { pwp_advance_vdisp(delta); }
#endif


static uint8_t stage[PWP_HU_CAP];
#ifdef PWP_EXPERIMENTAL_ZM2
/* Guest-side real CPU resident preboot, disabled in Pages production. */
#define PWP_TSR_MCB 0x0023fff0u
#define PWP_TSR_LOAD 0x00240000u
#define PWP_TSR_END 0x003c0000u
#define PWP_TSR_STACK 0x003e0000u
#define PWP_TSR_CMD 0x00008100u
#define PWP_TSR_ENV 0x0023fc00u
#define PWP_TSR_PSP 0x0023fd00u
static uint8_t tsr_saved_context[4096];
static uint32_t tsr_context_bytes, tsr_heap, tsr_status, tsr_steps;
static uint64_t tsr_saved_cycles,tsr_saved_vdisp,tsr_saved_scanout;
static uint32_t tsr_saved_ticks,tsr_saved_scans,tsr_saved_acks;
static int tsr_boot_active;
static uint32_t tsr_opm_isr_address;
/* X68000 16x16 gaiji glyphs $7670-$7675: pristine font RAM starts blank. */
static uint8_t tsr_gaiji[6][32];
#endif
static uint32_t size_image, size_bss, guest_steps, blocked_at, fault_addr;
static uint16_t blocked_op;
/* 0 reset; 1 active; 2 pending DOS/IOCS trap; 3 host read pending;
 * 4 normal process exit; negative failure */
#define PWP_PAN_HANDLE 5u
#define PWP_IO_CHUNK 65536u
#define PWP_MAX_BLOCKS 128u
/* Only one file is exposed to the guest. It is read-only, deliberately
 * preventing directory traversal, writes or access to arbitrary host data. */
static uint64_t pan_size, pan_pos;
static int pan_open, pan_mounted;
/* FIX25 read-only guest I/O evidence: counters never affect guest semantics. */
static uint32_t pwp_pan_read_calls, pwp_pan_open_calls;
static uint64_t pwp_pan_bytes_supplied;
static uint16_t pwp_last_dos_op, pwp_pan_error_op;
static uint32_t pwp_last_dos_pc;
static int32_t pwp_last_dos_return, pwp_pan_error_code;
static uint32_t pwp_pan_error_count;
static uint32_t io_dst, io_total, io_done, io_chunk;
/* A bounded, sorted set of guest memory blocks. No host heap used by _MALLOC. */
typedef struct { uint32_t hdr, end; } guest_block;
static guest_block allocs[PWP_MAX_BLOCKS];
static uint32_t alloc_count;
/* Console bytes are diagnostics only, not the guest video implementation. */
#define PWP_CONSOLE_CAP 8192u
static uint8_t console_bytes[PWP_CONSOLE_CAP];
static uint32_t console_length, console_truncated;
static int32_t state;
static uint16_t process_exit_code;
/* FIX45: The genuine PANIC.X uses DOS _INPOUT ($FF06, CODE=$00FF) for
 * nonblocking keyboard input. Host SPACE arrives as one ASCII $20 keystroke.
 * Human68k keyboard data is queued here, not written into PANIC.X memory
 * or synthesized as an IOCS/hardware interrupt. */
#define PWP_SPACE_QUEUE_LIMIT 16u
static uint32_t pwp_space_queued, pwp_space_consumed, pwp_space_rejected;
uint32_t pwp_mu_queue_space(void) {
  if(state!=1) { ++pwp_space_rejected;return 0; }
  if(pwp_space_queued>=PWP_SPACE_QUEUE_LIMIT){++pwp_space_rejected;return 0;}
  ++pwp_space_queued;return 1;
}
uint32_t pwp_mu_pending_space(void){return pwp_space_queued;}
uint32_t pwp_mu_consumed_space(void){return pwp_space_consumed;}
uint32_t pwp_mu_rejected_space(void){return pwp_space_rejected;}

/* Extended vectors are recorded for get/set symmetry. No IOCS/DOS handler
 * is invoked merely because a vector is installed: the actual hardware
 * service must eventually be provided by the complete guest runtime. */
static uint32_t iocs_vectors[256], dos_vectors[256];
/* IOCS $0E _TGUSEMD is a real X68000 screen-ownership service.
 * 0=unused, 1=system, 2=application, 3=screen contents destroyed.
 * The isolated runtime starts with both screens unused.  A query (D2.B=$FF)
 * has NO side effect; set (0..3) returns the former value.  This bookkeeping
 * does not itself claim that the graphics hardware has been initialized. */
static uint8_t iocs_screen_uses[2];
static uint32_t iocs_tgusemd_calls;
static uint32_t iocs_last_call_d1, iocs_last_call_d2;
/* R16 FIX7: IOCS $70 _MS_INIT. The physical mouse and pointer events are
 * not emulated yet; this records the initialized/hidden idle interface, NOT
 * fictitious movement, button input or a painted hardware cursor. */
static uint32_t iocs_ms_init_calls;
/* FIX10: CRTMOD $10. D1.W=-1 queries mode; PANIC.X uses mode 10:
 * 512x512 physical GVRAM, 256x256 visible, 256 colors, 2 pages, 31kHz.
 * _CRTMOD does not enable graphics; _G_CLR_ON ($90) is a separate service.
 * Keep an explicit initialized state instead of equating CRTMOD with pixels. */
static uint16_t iocs_crt_mode;
static uint32_t iocs_crtmod_calls;
static uint32_t iocs_gclr_calls;
static uint32_t iocs_sp_init_calls,iocs_sp_on_calls;
/* FIX29: Real IOCS ADPCM transport. Guest RAM retains original compressed
 * bytes. The host copies from guest memory IMMEDIATELY after the service;
 * never write guest audio data or synthesize a success for invalid chains. */
static uint32_t adpcm_event_serial, adpcm_event_kind, adpcm_chain_addr;
static uint32_t adpcm_chain_count, adpcm_mode, adpcm_control_calls, adpcm_chain_calls;


static uint8_t mouse_initialized,mouse_cursor_visible;
/* R16 FIX9: Human68k DOS _CONCTRL (FF23) limited state.
 * Graphics screen-mode changes must NOT be reported as hardware-ready
 * until CRTC/video wiring is provided; current-mode reads are real DOS
 * state queries and do not mutate graphics memory. */
static uint16_t conctrl_screen_mode,conctrl_fnkeys_mode;
static uint8_t conctrl_cursor_visible;
static uint32_t conctrl_calls;





static int within(uint32_t addr, uint32_t len) {
  return addr < PWP_RAM_BYTES && len <= PWP_RAM_BYTES - addr;
}
static uint16_t u16(const uint8_t *p) {return (uint16_t)(((uint16_t)p[0] << 8) | p[1]);}
static uint32_t u32(const uint8_t *p) {return ((uint32_t)u16(p) << 16) | u16(p+2);}
static void w16(uint8_t *p, uint16_t v) {p[0]=(uint8_t)(v>>8);p[1]=(uint8_t)v;}
static void w32(uint8_t *p, uint32_t v) {w16(p,(uint16_t)(v>>16)); w16(p+2,(uint16_t)v);}
static void invalid_bus(uint32_t address) {
  fault_addr=address;
  if (state > 0) {state = -8; m68k_end_timeslice();}
}
/* Each non-RAM byte is routed to the supported video device subset.
 * Unknown I/O, sound, firmware and bus addresses retain fail-closed status.
 * 16/32-bit reads and writes reject odd addresses and span validation is
 * performed before writing any bytes (no half-committed guest MMIO). */
/* 68000 has a 24-bit physical address bus. Mask every byte transaction,
 * not only the first byte in a 16/32-bit access. The original 32-bit
 * address is preserved for failure diagnostics. */
static uint32_t physical24(uint32_t a) {return a & 0x00ffffffu;}
static int address8(uint32_t a, int for_write) {
  a=physical24(a);
#ifdef PWP_EXPERIMENTAL_ZM2
  if(!for_write && (tsr_boot_active || tsr_status==2u) &&
     a>=0x00fefff0u && a<0x00ff0020u)return 1;
#endif
  return within(a,1)||(for_write?pwp_bus_writable8(a):pwp_bus_access8(a));
}
static int busread(uint32_t a,uint8_t *value) {
  a=physical24(a);
  if(within(a,1)){*value=ram[a];return 1;}
#ifdef PWP_EXPERIMENTAL_ZM2
  /* Minimal IPL ROM window: readable signatures before default trap
   * vectors, but no emulated resident driver or executable ROM service. */
  if((tsr_boot_active || tsr_status==2u) &&
     a>=0x00fefff0u && a<0x00ff0020u){*value=0;return 1;}
#endif
  return pwp_bus_read8(a,value);
}
static int buswrite(uint32_t a,uint8_t v) {
  a=physical24(a);
  if(within(a,1)){ram[a]=v;return 1;}
  return pwp_bus_write8(a,v);
}
static int span(uint32_t a,uint32_t n,int for_write) {
  if(a>UINT32_MAX-n+1u)return 0;
  for(uint32_t i=0;i<n;i++)if(!address8(a+i,for_write))return 0;
  return 1;
}
unsigned int m68k_read_memory_8(unsigned int a) {
  uint8_t value;
  if(!busread(a,&value)){invalid_bus(a);return 0;}
  return value;
}
unsigned int m68k_read_memory_16(unsigned int a) {
  uint8_t b0,b1;
  if((a&1u)||!span(a,2,0)){invalid_bus(a);return 0;}
  (void)busread(a,&b0);(void)busread(a+1u,&b1);
  return ((uint16_t)b0<<8)|b1;
}
unsigned int m68k_read_memory_32(unsigned int a) {
  uint8_t b0,b1,b2,b3;
  if((a&1u)||!span(a,4,0)){invalid_bus(a);return 0;}
  (void)busread(a,&b0);(void)busread(a+1u,&b1);
  (void)busread(a+2u,&b2);(void)busread(a+3u,&b3);
  return ((uint32_t)b0<<24)|((uint32_t)b1<<16)|((uint32_t)b2<<8)|b3;
}
void m68k_write_memory_8(unsigned int a,unsigned int v) {
  if(!buswrite(a,(uint8_t)v))invalid_bus(a);
}
void m68k_write_memory_16(unsigned int a,unsigned int v) {
  if((a&1u)||!span(a,2,1)){invalid_bus(a);return;}
  (void)buswrite(a,(uint8_t)(v>>8));(void)buswrite(a+1u,(uint8_t)v);
}
void m68k_write_memory_32(unsigned int a,unsigned int v) {
  if((a&1u)||!span(a,4,1)){invalid_bus(a);return;}
  (void)buswrite(a,(uint8_t)(v>>24));(void)buswrite(a+1u,(uint8_t)(v>>16));
  (void)buswrite(a+2u,(uint8_t)(v>>8));(void)buswrite(a+3u,(uint8_t)v);
}
/* Native-only test staging hook; omitted entirely from production build. */
#ifdef PWP_TEST_STAGE
int pwp_mu_test_stage_byte(uint32_t i, uint32_t value) {
  if (i >= PWP_HU_CAP || value > 255u) return 0;
  stage[i] = (uint8_t)value;
  return 1;
}
#endif
/* R13 native host probe: the browser ABI remains uint32 for WASM32,
 * while 64-bit host tools must never truncate a staging buffer pointer. */
#ifndef __EMSCRIPTEN__
uintptr_t pwp_mu_stage_native_ptr(void) {return (uintptr_t)stage;}
#endif
uint32_t pwp_mu_stage_ptr(void) {return (uint32_t)(uintptr_t)stage;}
uint32_t pwp_mu_stage_capacity(void) {return PWP_HU_CAP;}
void pwp_mu_reset(void) {
  memset(ram,0,sizeof(ram));
  /* A real Human68k boot leaves uninstalled TRAP vectors pointing outside
   * user RAM (firmware). Zero here is unsafe: Z-MUSIC v2's standard presence
   * probe reads vector $8C, subtracts 8 and otherwise dereferences $FFFFF8.
   * Use an UNHANDLED ROM-range target so the guest correctly concludes
   * Z-MUSIC is absent. It is NOT a resident marker, driver or callable stub.
   * Actual trap #3 without a driver remains an unmapped, fail-closed access.
   * When a real driver later registers vector 35, this value is replaced. */
  w32(ram+0x8cu,0x00ff0000u);
  pwp_bus_reset();
  size_image=size_bss=guest_steps=blocked_at=fault_addr=0;
#ifdef PWP_EXPERIMENTAL_ZM2
  tsr_context_bytes=tsr_heap=tsr_status=tsr_steps=0;
  tsr_saved_cycles=tsr_saved_vdisp=tsr_saved_scanout=0;
  tsr_saved_ticks=tsr_saved_scans=tsr_saved_acks=0;
  tsr_boot_active=0;
  tsr_opm_isr_address=0;
  memset(tsr_gaiji,0,sizeof(tsr_gaiji));
#endif
  pwp_guest_cycles=0;
  pwp_next_vdisp=PWP_ACTIVE_CYCLES;
  pwp_next_scanout=PWP_VDISP_CYCLES;
  pwp_scanout_ticks=0;
  pwp_vdisp_ticks=pwp_vdisp_acks=0;
  pwp_vdisp_pending=0;
  blocked_op=0;
  state=0;
  pan_size=pan_pos=0;
  pan_open=pan_mounted=0;
  pwp_pan_read_calls=pwp_pan_open_calls=0; pwp_pan_bytes_supplied=0;
  pwp_last_dos_op=pwp_pan_error_op=0; pwp_last_dos_pc=0;
  pwp_last_dos_return=pwp_pan_error_code=0; pwp_pan_error_count=0;
  io_dst=io_total=io_done=io_chunk=alloc_count=0;
  memset(allocs,0,sizeof allocs);
  console_length=console_truncated=process_exit_code=0;
  pwp_space_queued=pwp_space_consumed=pwp_space_rejected=0;
  memset(console_bytes,0,sizeof console_bytes);
  memset(iocs_vectors,0,sizeof iocs_vectors);
  memset(dos_vectors,0,sizeof dos_vectors);
  iocs_screen_uses[0]=iocs_screen_uses[1]=0;
  iocs_tgusemd_calls=iocs_last_call_d1=iocs_last_call_d2=0;
  iocs_ms_init_calls=0;
  iocs_crt_mode=0; iocs_crtmod_calls=0; iocs_gclr_calls=0;
  iocs_sp_init_calls=iocs_sp_on_calls=0;
  adpcm_event_serial=adpcm_event_kind=adpcm_chain_addr=0;
  adpcm_chain_count=adpcm_mode=adpcm_control_calls=adpcm_chain_calls=0;
  mouse_initialized=mouse_cursor_visible=0;
  conctrl_screen_mode=0; /* Human68k text-only initial screen mode. */
  conctrl_fnkeys_mode=0;
  conctrl_cursor_visible=1;
  conctrl_calls=0;

}
int32_t pwp_mu_load(uint32_t n) {
  pwp_mu_reset();
  if (n < 64 || n > PWP_HU_CAP) return state=-1;
  if (stage[0]!='H' || stage[1]!='U') return state=-2;
  const uint32_t base=u32(stage+4), entry=u32(stage+8);
  const uint32_t text=u32(stage+12), data=u32(stage+16), bss=u32(stage+20);
  const uint32_t reloc=u32(stage+24), symbols=u32(stage+28);
  const uint64_t init=(uint64_t)text+data;
  const uint64_t source=(uint64_t)64+init+reloc+symbols;
  const uint64_t dest=(uint64_t)PWP_LOAD+init+bss;
  if (base || !text || entry >= init || source>n || dest>=PWP_LIMIT) return state=-3;
  /* The verified PANIC.X V1.38 has zero relocations. Fail closed for now. */
  if (reloc) return state=-4;
  memcpy(ram+PWP_LOAD,stage+64,(size_t)init);
  size_image=(uint32_t)(PWP_LOAD+init);
  size_bss=(uint32_t)dest;
  /* MCB/PSP: 16-byte memory control block preceding executable. The
     first process has one memory allocation covering [PWP_LOAD,PWP_LIMIT). */
  w32(ram+PWP_MCB+0, 0);
  w32(ram+PWP_MCB+4, PWP_MCB);
  w32(ram+PWP_MCB+8, PWP_LIMIT);
  w32(ram+PWP_MCB+12,0);
  /* Startup command line must be guest-addressable: a2=length-prefixed
   * LASCII. Without this panic.x receives NO media filename even if its
   * real CPU and DOS services later work. One fixed virtual PAN path is
   * exposed; host paths and user filenames are never copied to guest RAM. */
  const uint32_t cmd_len=(uint32_t)sizeof(pwp_command_line)-1u;
  if (cmd_len>255u || !within(PWP_CMDLINE, cmd_len+2u)) return state=-3;
  ram[PWP_CMDLINE]=(uint8_t)cmd_len;
  memcpy(ram+PWP_CMDLINE+1u,pwp_command_line,cmd_len);
  ram[PWP_CMDLINE+1u+cmd_len]=0;
  /* Reset vectors must be valid before m68k_pulse_reset. */
  w32(ram+0, PWP_LIMIT);
  w32(ram+4, PWP_LOAD+entry);
  m68k_init();
  m68k_set_cpu_type(M68K_CPU_TYPE_68000);
  m68k_pulse_reset();
  /* Stock Musashi carries reset exception cycles into m68k_execute().
   * Its first 1-cycle call after pulse_reset() consumes ONLY that reset
   * penalty, without fetching an instruction. Pay that cost here instead
   * of falsely counting it as a guest instruction in pwp_mu_run().
   * Verify no guest opcode has executed; this is an audited Tab5 source gate. */
  {
    const uint32_t reset_pc = m68k_get_reg(NULL,M68K_REG_PC);
    (void)m68k_execute(1);
    if (m68k_get_reg(NULL,M68K_REG_PC) != reset_pc) return state=-10;
  }
  m68k_set_reg(M68K_REG_SR,0);
  m68k_set_reg(M68K_REG_A0,PWP_MCB);
  /* Human68k A1 is program end+1, NOT the end of the initial full-size
   * process allocation. PANIC.X computes (A1-(A0+16)) for _SETBLOCK,
   * releases the rest, and then _MALLOCs its 256KiB PAN workspace.
   * Using PWP_LIMIT here retained the entire RAM allocation, so _MALLOC
   * inevitably returned -8 and PANIC.X exited before opening any PAN. */
  m68k_set_reg(M68K_REG_A1,size_bss);
  m68k_set_reg(M68K_REG_A2,PWP_CMDLINE);
  m68k_set_reg(M68K_REG_A3,0xffffffffu);
  m68k_set_reg(M68K_REG_A4,PWP_LOAD+entry);
  /* The Musashi public SR setter changes flags without switching A7.
   * Seed both stack banks explicitly after reset, so DOS _SUPER can return
   * the original system stack and execute with SSP copied from USP. */
  m68k_set_reg(M68K_REG_USP,PWP_LIMIT);
  m68k_set_reg(M68K_REG_ISP,PWP_LIMIT);
  m68k_set_reg(M68K_REG_A7,PWP_LIMIT);
  m68k_set_reg(M68K_REG_PC,PWP_LOAD+entry);
  return state=1;
}
/* The staged user PAN exists only as a Blob in the browser. Every DOS
 * _READ is split into bounded chunks; a host Worker copies bytes to the
 * stage buffer, then calls pwp_mu_supply_read(). _READ returns to the
 * guest only when all requested bytes (or EOF) have been consumed.
 * Status 3 is not CPU execution: the host must fulfill the pending I/O. */
static void complete_dos(int32_t value) {
  pwp_last_dos_op=blocked_op;
  pwp_last_dos_pc=blocked_at;
  pwp_last_dos_return=value;
  /* Only errors returned by PAN file IO. _NFILES -18 is ordinary EOF,
   * and is NOT a malformed PAN or an I/O failure. */
  if(value<0 && (blocked_op==0xff3du || blocked_op==0xff3fu || blocked_op==0xff42u)) {
    pwp_pan_error_op=blocked_op;
    pwp_pan_error_code=value;
    ++pwp_pan_error_count;
  }
  m68k_set_reg(M68K_REG_D0,(uint32_t)value);
  m68k_set_reg(M68K_REG_PC,blocked_at+2u);
  blocked_op=0;
  state=1;
}
static int pan_path_is_staged(uint32_t address) {
  if (!within(address,1)) return 0;
  char name[64];
  uint32_t n=0;
  while (n<sizeof(name)-1 && within(address+n,1)) {
    char ch=(char)ram[address+n];
    if (!ch) break;
    if (ch>='a' && ch<='z') ch=(char)(ch-'a'+'A');
    name[n++]=ch;
  }
  if (n==sizeof(name)-1 || !within(address+n,1) || ram[address+n]) return 0;
  name[n]=0;
  /* Accept exactly the Tab5 transport basename, optionally at drive root. */
  const char *p=name;
  if (n>=3 && name[1]==':' && name[0]>='A' && name[0]<='Z') p+=2;
  if (*p=='\\' || *p=='/') ++p;
  return strcmp(p,"P68K.PAN")==0;
}
static uint32_t io_next(void) {
  const uint32_t remaining=io_total-io_done;
  io_chunk=remaining>PWP_IO_CHUNK?PWP_IO_CHUNK:remaining;
  const uint64_t bytes_left=pan_pos>=pan_size?0:pan_size-pan_pos;
  if (bytes_left<io_chunk) io_chunk=(uint32_t)bytes_left;
  if (!io_chunk) {
    complete_dos((int32_t)io_done);
    return 0;
  }
  state=3;
  return io_chunk;
}
void pwp_mu_set_pan_size(uint32_t high,uint32_t low) {
  /* Call only after HU load. Resetting the guest clears the mounted file. */
  if (state!=0 && state!=1) return;
  pan_size=((uint64_t)high<<32)|low;
  pan_pos=0;
  pan_open=0;
  pan_mounted=1;
}
/* R14: native x64 file-stage pointer. The public WASM32 ABI remains uint32.
 * A native probe must NEVER cast the exported WASM32 address to a host
 * pointer: upper address bits would be lost on 64-bit Windows/Linux. */
#ifndef __EMSCRIPTEN__
uintptr_t pwp_mu_io_stage_native_ptr(void) {return (uintptr_t)stage;}
#endif
uint32_t pwp_mu_io_stage_ptr(void) {return pwp_mu_stage_ptr();}
uint32_t pwp_mu_io_capacity(void) {return PWP_IO_CHUNK;}
uint32_t pwp_mu_io_offset_high(void) {return (uint32_t)(pan_pos>>32);}
uint32_t pwp_mu_io_offset_low(void) {return (uint32_t)pan_pos;}
uint32_t pwp_mu_io_length(void) {return state==3?io_chunk:0;}
/* 0 <= count <= pending request. Returns 3 if more data needed, 1 when
 * the DOS call completes, negative on bridge protocol violation. */
int32_t pwp_mu_supply_read(uint32_t count) {
  if (state!=3 || count>io_chunk || io_done>io_total ||
      io_done>UINT32_MAX-io_dst || !within(io_dst,io_total) ||
      !within(io_dst+io_done,count)) {
    return state=-12;
  }
  if (count) memcpy(ram+io_dst+io_done,stage,count);
  io_done+=count;
  pwp_pan_bytes_supplied+=count;
  pan_pos+=count;
  if (count<io_chunk || io_done>=io_total || pan_pos>=pan_size) {
    complete_dos((int32_t)io_done);
    return state;
  }
  io_next();
  return state;
}
/* Human68k MCB: [prev, owner, end+1, next]. Keep the visible
 * chain deterministic, including allocations that have been freed. */
static uint32_t proc_end(void) { return u32(ram+PWP_MCB+8); }
static void relink_blocks(void) {
  w32(ram+PWP_MCB+12,alloc_count?allocs[0].hdr:0);
  for(uint32_t i=0;i<alloc_count;i++){
    const uint32_t here=allocs[i].hdr;
    w32(ram+here+0,i?allocs[i-1].hdr:PWP_MCB);
    w32(ram+here+4,PWP_MCB);
    w32(ram+here+8,allocs[i].end);
    w32(ram+here+12,i+1<alloc_count?allocs[i+1].hdr:0);
  }
}
static uint32_t align16(uint32_t n) {return (n+15u)&~15u;}
static uint32_t max_free_guest_block(void) {
  uint32_t low=align16(proc_end()),best=0;
  for(uint32_t i=0;i<=alloc_count;i++) {
    const uint32_t hi=(i<alloc_count)?allocs[i].hdr:PWP_LIMIT;
    if(hi>low+16u && hi-low-16u>best) best=hi-low-16u;
    if(i<alloc_count)low=align16(allocs[i].end);
  }
  return best;
}
static int32_t malloc_guest(uint32_t n){
  if(n==0xffffffffu) return (int32_t)max_free_guest_block();
  if(n==0 || n>0x7fffffe0u || alloc_count>=PWP_MAX_BLOCKS)return -8;
  uint32_t size=align16(n);
  uint32_t low=align16(proc_end());
  uint32_t idx=0;
  for(;idx<=alloc_count;idx++){
    uint32_t upper=(idx<alloc_count)?allocs[idx].hdr:PWP_LIMIT;
    if(upper>=low+16u && upper-low-16u>=size) break;
    if(idx<alloc_count)low=align16(allocs[idx].end);
  }
  if(idx>alloc_count)return -8;
  for(uint32_t i=alloc_count;i>idx;i--)allocs[i]=allocs[i-1];
  allocs[idx].hdr=low;allocs[idx].end=low+16u+size;alloc_count++;
  relink_blocks();
  return (int32_t)(low+16u);
}
static int32_t free_guest(uint32_t ptr){
  for(uint32_t i=0;i<alloc_count;i++)if(allocs[i].hdr+16u==ptr){
    memset(ram+allocs[i].hdr,0,16);
    for(uint32_t j=i+1;j<alloc_count;j++)allocs[j-1]=allocs[j];
    alloc_count--;relink_blocks();return 0;
  }
  return -22;
}
/* R16 FIX8: Human68k _NAMECK expands a caller filename into exactly
 * 91 bytes: drive[2], absolute path[65], base[19], extension[5].
 * This deliberately covers the virtual root drive and ordinary filenames,
 * not a host filesystem. Unsupported wildcard and sub-drive semantics return
 * DOS errors rather than fabricating a successful expansion. */
#define PWP_NAMECK_BYTES 91u
#define PWP_FILES_BYTES 53u
static int32_t expand_guest_name(uint32_t source, uint8_t result[PWP_NAMECK_BYTES]) {
  char input[256];
  uint32_t n=0;
  if(!within(source,1))return -14;
  while(n<sizeof(input)-1u && within(source+n,1)) {
    const uint8_t ch=ram[source+n];
    if(!ch)break;
    if(ch<32u || ch==127u)return -13;
    input[n++]=(char)((ch>='a'&&ch<='z')?(ch-'a'+'A'):ch);
  }
  if(n==sizeof(input)-1u || !within(source+n,1) || ram[source+n])return -13;
  input[n]=0;
  if(!n)return 0xff;
  const char *p=input;
  char drive='C';
  if(n>=2u && p[1]==':') {
    drive=p[0];
    if(drive<'A'||drive>'Z')return -15;
    if(drive!='C')return -15; /* Only the isolated C: virtual drive exists. */
    p+=2;
  }
  memset(result,0,PWP_NAMECK_BYTES);
  result[0]=(uint8_t)drive;result[1]=':';
  const char *last=p;
  for(const char *q=p;*q;q++) {
    if(*q=='/' || *q=='\\')last=q+1;
    else if(*q==':' || *q=='<' || *q=='>' || *q=='|' || *q=='"' || *q=='*' || *q=='?')return -13;
  }
  const size_t pathlen=(size_t)(last-p);
  if(pathlen>63u)return -13;
  result[2]='\\';
  size_t pathidx=1;
  if(pathlen) {
    for(size_t i=0;i<pathlen;i++) {
      const char c=p[i];
      if(i==0u && (c=='/' || c=='\\'))continue;
      result[2+pathidx++]=(uint8_t)(c=='/'?'\\':c);
    }
  }
  if(pathidx>1 && result[2+pathidx-1]!='\\')result[2+pathidx++]='\\';
  if(pathidx>64u)return -13;
  result[2+pathidx]=0;
  const char *dot=NULL;
  for(const char *q=last;*q;q++)if(*q=='.')dot=q;
  const size_t base_len=(size_t)((dot?dot:last+strlen(last))-last);
  const size_t ext_len=dot?strlen(dot+1):0u;
  if(base_len>18u||ext_len>3u||(dot && !ext_len))return -13;
  if(base_len)memcpy(result+67,last,base_len);
  if(dot){result[86]='.';memcpy(result+87,dot+1,ext_len);}
  return 0;  /* ordinary filename; no wildcard */
}
/* Only one virtual read-only file is mounted. FILES must not enumerate host
 * directories or claim nonexistent media. A bounded wildcard matcher allows
 * PANIC.X's initial file existence check without general filesystem access. */
static int virtual_name_match(const char *pattern) {
  static const char target[]="P68K.PAN";
  const char *q=target;
  const char *star=NULL,*retry=NULL;
  while(*q) {
    char c=*pattern;
    if(c>='a'&&c<='z')c=(char)(c-'a'+'A');
    if(c=='*'){star=++pattern;retry=q;continue;}
    if(c=='?'||c==*q){pattern++;q++;continue;}
    if(star){pattern=star;q=++retry;continue;}
    return 0;
  }
  while(*pattern=='*')pattern++;
  return *pattern==0;
}
static int guest_virtual_path(uint32_t guest_ptr, char *name, uint32_t cap) {
  uint32_t i=0;
  if(!within(guest_ptr,1))return 0;
  while(i+1u<cap && within(guest_ptr+i,1)) {
    uint8_t c=ram[guest_ptr+i];
    if(!c){name[i]=0;return 1;}
    if(c<32u||c>=127u)return 0;
    name[i++]=(char)c;
  }
  return 0;
}
static int virtual_file_match(const char *raw) {
  const char *p=raw;
  if(p[0]&&p[1]==':') {
    char d=p[0];if(d>='a'&&d<='z')d=(char)(d-'a'+'A');
    if(d!='C')return 0;
    p+=2;
  }
  if(*p=='/'||*p=='\\')p++;
  if(strchr(p,'/')||strchr(p,'\\')||strchr(p,':'))return 0;
  return virtual_name_match(p);
}
#ifdef PWP_EXPERIMENTAL_ZM2
#include "pwp_zm2_preboot.inc"
#endif
/* Human68k passes the most recently pushed arguments first on the user
 * stack, in big-endian word/longword slots. Malformed guest pointers fail
 * with a DOS-style error and never access outside guest RAM. */
int32_t pwp_mu_dispatch(void) {
  if (state!=2) return state;
  const uint32_t sp=m68k_get_reg(NULL,M68K_REG_A7);
  if (!within(sp,1)) return state=-8;
  uint32_t ptr=0,requested=0;
  /* IOCS uses TRAP #15 (opcode 4E4F), not Human68k F-line DOS.
   * D0.B selects the function; args are CPU registers rather than user SP.
   * Only the separately documented _TGUSEMD ($0E) and _MS_INIT ($70)
   * are implemented. Other IOCS calls fail closed. */
  if(blocked_op==0x4e4fu) {
    const uint32_t fn=m68k_get_reg(NULL,M68K_REG_D0)&0xffu;
#ifdef PWP_EXPERIMENTAL_ZM2
    if(tsr_boot_active && fn==0x6au) { /* IOCS _OPMINTST: register REAL guest ISR. */
      const uint32_t handler=m68k_get_reg(NULL,M68K_REG_A1);
      if(handler && ((handler&1u)||!within(handler,2u)))return state=-18;
      tsr_opm_isr_address=handler;
      /* Registration does not fabricate a YM2151 interrupt; timer-based
       * delivery still requires a genuine OPM timer peripheral. */
      complete_dos(0);return state;
    }
    if(tsr_boot_active && fn==0x81u) { /* IOCS _B_SUPER: real SR/stack banks. */
      const uint32_t target=m68k_get_reg(NULL,M68K_REG_A1);
      const uint32_t sr=m68k_get_reg(NULL,M68K_REG_SR);
      if(!target) {
        if(sr&0x2000u){complete_dos(-1);return state;}
        const uint32_t old=m68k_get_reg(NULL,M68K_REG_ISP);
        const uint32_t usp=m68k_get_reg(NULL,M68K_REG_USP);
        if((old&1u)||!within(old,1u)||!within(usp,1u))return state=-18;
        m68k_set_reg(M68K_REG_SR,sr|0x2000u);
        m68k_set_reg(M68K_REG_USP,usp);
        m68k_set_reg(M68K_REG_ISP,usp);
        complete_dos((int32_t)old);return state;
      }
      if(!(sr&0x2000u)||(target&1u)||!within(target,1u))
        return state=-18;
      const uint32_t usp=m68k_get_reg(NULL,M68K_REG_USP);
      if((usp&1u)||!within(usp,1u))return state=-18;
      m68k_set_reg(M68K_REG_SR,sr&~0x2000u);
      m68k_set_reg(M68K_REG_ISP,target);
      m68k_set_reg(M68K_REG_USP,usp);
      complete_dos(0);return state;
    }
    if(tsr_boot_active && fn==0x0fu) { /* IOCS _DEFCHR: genuine 16x16 gaiji restore. */
      const uint32_t d1=m68k_get_reg(NULL,M68K_REG_D1);
      const uint32_t code=d1&0xffffu;
      const uint32_t bitmap=m68k_get_reg(NULL,M68K_REG_A1);
      /* Z-MUSIC's do_gj feeds only the 32-byte pixel bitmap, not a
       * _FNTGET-style width/height header. Maintain a real guest glyph bank. */
      if((d1>>16)!=8u || code<0x7670u || code>0x7675u ||
         (bitmap&1u) || !within(bitmap,32u))return state=-18;
      memcpy(tsr_gaiji[code-0x7670u],ram+bitmap,32u);
      complete_dos(0);return state;
    }
    if(tsr_boot_active && fn==0x19u) { /* IOCS _FNTGET, documented D1/A1 ABI. */
      const uint32_t d1=m68k_get_reg(NULL,M68K_REG_D1);
      const uint32_t code=d1&0xffffu;
      const uint32_t buffer=m68k_get_reg(NULL,M68K_REG_A1);
      /* Z-MUSIC saves the six 16x16 user-definable glyphs. Preserve the
       * genuine, initially-empty gaiji bank rather than fabricating art. */
      if((d1>>16)!=8u || code<0x7670u || code>0x7675u ||
         (buffer&1u) || !within(buffer,36u))return state=-18;
      w16(ram+buffer,16u);w16(ram+buffer+2u,16u);
      memcpy(ram+buffer+4u,tsr_gaiji[code-0x7670u],32u);
      complete_dos(0);return state;
    }
    if(tsr_boot_active && fn==0x80u) { /* Guest IOCS _B_INTVCS. */
      const uint32_t vec=m68k_get_reg(NULL,M68K_REG_D1)&0xffffu;
      const uint32_t new_addr=m68k_get_reg(NULL,M68K_REG_A1);
      uint32_t old;
      if((new_addr&1u)||!within(new_addr,2))return state=-18;
      if(vec<256u){
        old=u32(ram+vec*4u);w32(ram+vec*4u,new_addr);
      }else if(vec>=0x100u && vec<=0x1ffu){
        old=iocs_vectors[vec-0x100u];iocs_vectors[vec-0x100u]=new_addr;
      }else return state=-18;
      complete_dos((int32_t)old);return state;
    }
#endif
    if(fn==0x67u) { /* _ADPCMMOD: D1.L stop=0, pause=1, resume=2. */
      const uint32_t control=m68k_get_reg(NULL,M68K_REG_D1);
      if(control>2u){complete_dos(-1);return state;}
      adpcm_event_kind=control; /* 0 stop, 1 pause, 2 resume */
      ++adpcm_event_serial; ++adpcm_control_calls;
      complete_dos(0);
      return state;
    }
    if(fn==0x62u) { /* _ADPCMAOT: D1.W mode, D2.L entry count, A1.L table. */
      const uint32_t mode=m68k_get_reg(NULL,M68K_REG_D1)&0xffffu;
      const uint32_t count=m68k_get_reg(NULL,M68K_REG_D2);
      const uint32_t table=m68k_get_reg(NULL,M68K_REG_A1);
      /* Bounded DMA array chain: 6 bytes per entry, BE [addr.l,size.w].
       * Reject invalid/missing RAM and unsupported timing shapes rather
       * than returning 'success' with no sound. */
      if(count==0u||count>256u||table&1u||!within(table,count*6u)
         ||((mode>>8)&7u)>4u) return state;
      uint32_t total=0;
      for(uint32_t i=0;i<count;i++){
        const uint32_t addr=u32(ram+table+i*6u);
        const uint32_t bytes=u16(ram+table+i*6u+4u);
        if(!bytes||!within(addr,bytes)||total>0x40000u-bytes)return state;
        total+=bytes;
      }
      adpcm_chain_addr=table;adpcm_chain_count=count;adpcm_mode=mode;
      adpcm_event_kind=3u; /* Chain-data event; do not mutate its source */
      ++adpcm_event_serial;++adpcm_chain_calls;
      complete_dos(0); /* D0 unspecified on hardware; caller cannot rely on it. */
      return state;
    }
    if(fn==0x7fu) { /* Standard IOCS _ONTIME: guest-clock centiseconds and days. */
      const uint64_t cs = pwp_guest_cycles / (PWP_X68K_CPU_HZ / 100ull);
      const uint64_t day_cs = 8640000ull;
      m68k_set_reg(M68K_REG_D1, (uint32_t)((cs / day_cs) & 0xffffull));
      complete_dos((int32_t)(cs % day_cs));
      return state;
    }
    if(fn==0x70u) { /* _MS_INIT: initialize/reset mouse subsystem. */
      mouse_initialized=1;
      mouse_cursor_visible=0;
      ++iocs_ms_init_calls;
      /* _MS_INIT has no documented return value. Use a deterministic zero
       * in this subset; no virtual mouse event/cursor is synthesized. */
      complete_dos(0);
      return state;
    }
    if(fn==0xc0u) { /* _SP_INIT, IOCS: reset CYNTHIA sprite and BG. */
      if(iocs_crt_mode!=10u || !pwp_bus_sp_init10()){
        complete_dos(-1); /* Documented bad screen mode. */
      }else{
        ++iocs_sp_init_calls;
        complete_dos(0);
      }
      return state;
    }
    if(fn==0xc1u) { /* _SP_ON: enable sprite layer after init. */
      if(iocs_crt_mode!=10u || !pwp_bus_sp_on10()){
        complete_dos(-1);
      }else{
        ++iocs_sp_on_calls;
        complete_dos(0);
      }
      return state;
    }
    if(fn==0xc2u) { /* _SP_OFF: gate off only; do not erase guest PCG/BG. */
      if(iocs_crt_mode!=10u || !pwp_bus_sp_off10()) complete_dos(-1);
      else complete_dos(0);
      return state;
    }
    if(fn==0x90u) { /* _G_CLR_ON: graphic clear + enable after CRTMOD. */
      if (iocs_crt_mode!=10u || !pwp_bus_g_clr_on10()) return state;
      ++iocs_gclr_calls;
      /* No specified return register: preserve caller's other registers;
       * adapter uses deterministic zero for its successful IOCS subset. */
      complete_dos(0);
      return state;
    }
    if(fn==0x10u) { /* IOCS _CRTMOD */
      const uint32_t d1=m68k_get_reg(NULL,M68K_REG_D1)&0xffffu;
      if(d1==0xffffu) { /* Query current mode, no video mutations. */
        ++iocs_crtmod_calls;
        complete_dos((int32_t)iocs_crt_mode);
        return state;
      }
      /* Mode 10 is the one observed from authentic PANIC.X at $012c86.
       * Other mode-setting requests require mode-specific hardware timing
       * and are NOT falsely accepted. */
      if(d1!=10u || !pwp_bus_apply_crtmod10()) return state;
      iocs_crt_mode=10u;
      ++iocs_crtmod_calls;
      complete_dos(0); /* Set-mode return is unspecified; D0 not used by PANIC.X. */
      return state;
    }
    if(fn!=0x0eu) return state; /* Other IOCS calls: fail closed. */
    const uint32_t d1=m68k_get_reg(NULL,M68K_REG_D1)&0xffu;
    const uint32_t d2=m68k_get_reg(NULL,M68K_REG_D2)&0xffu;
    iocs_last_call_d1=d1; iocs_last_call_d2=d2;
    /* Bad screen number is a defined -1 return.  Unsupported status
     * codes do not invent a successful hardware transition. */
    if(d1>1u) { ++iocs_tgusemd_calls; complete_dos(-1); return state; }
    if(d2==0xffu) { /* query only */ }
    else if(d2<=3u) { /* mutate after remembering former value below */ }
    else return state;
    const uint8_t previous=iocs_screen_uses[d1];
    if(d2!=0xffu) iocs_screen_uses[d1]=(uint8_t)d2;
    ++iocs_tgusemd_calls;
    complete_dos((int32_t)previous);
    return state;
  }
  switch(blocked_op) {
    case 0xff20: { /* Human68k _SUPER: real SR, USP and ISP semantics. */
      if ((sp & 1u) || !within(sp,4)) return state=-8;
      const uint32_t arg=u32(ram+sp);
      const uint32_t sr=m68k_get_reg(NULL,M68K_REG_SR);
      if (arg==0u) {
        /* User -> supervisor: copy USP to SSP; return the PREVIOUS SSP.
         * On a real DOS/IOCS _SUPER call, code after the F-line continues
         * using the same guest stack bytes on the supervisor stack. */
        if (sr & 0x2000u) {complete_dos(-1);break;}
        const uint32_t previous_ssp=m68k_get_reg(NULL,M68K_REG_ISP);
        if ((previous_ssp & 1u) || !within(previous_ssp,1)) {
          complete_dos(-14);break;
        }
        /* Public SR setter is *_nosp: flip to S first, then write
         * the now-INACTIVE USP bank and ACTIVE ISP/A7 separately. */
        m68k_set_reg(M68K_REG_SR,sr|0x2000u);
        m68k_set_reg(M68K_REG_USP,sp);
        m68k_set_reg(M68K_REG_ISP,sp);
        complete_dos((int32_t)previous_ssp);
      } else {
        /* Supervisor -> user: restore saved SSP and active user USP.
         * Reject an impossible saved stack instead of creating an invalid
         * privileged stack pointer. */
        if (!(sr & 0x2000u) || (arg & 1u) || !within(arg,1)) {
          complete_dos(-14);break;
        }
        const uint32_t previous_usp=m68k_get_reg(NULL,M68K_REG_USP);
        if ((previous_usp & 1u) || !within(previous_usp,1)) {
          complete_dos(-14);break;
        }
        /* After S is clear, ISP is the inactive bank and USP sets
         * the live A7. This also records the restored SSP for later. */
        m68k_set_reg(M68K_REG_SR,sr&~0x2000u);
        m68k_set_reg(M68K_REG_ISP,arg);
        m68k_set_reg(M68K_REG_USP,previous_usp);
        complete_dos(0);
      }
      break;
    }
    case 0xff23: { /* _CONCTRL: only modes needed by genuine PANIC.X init. */
      if ((sp&1u) || !within(sp,2)) return state=-8;
      const uint16_t md=u16(ram+sp);
      if(md==16u){ /* graphics mode: MOD=-1 queries without changing. */
        if(!within(sp,4)) return state=-8;
        const int16_t mod=(int16_t)u16(ram+sp+2);
        if(mod==-1){ ++conctrl_calls; complete_dos((int32_t)conctrl_screen_mode); break; }
        /* FIX30: PANIC.X saves its original Human68k mode at startup and
         * restores it on exit (real HU $12CB2). Only the observed initial
         * mode 0, with NO graphics plane, is supported here. Preserve the
         * last PAN frame in the host canvas. Do NOT pretend to initialize
         * unimplemented screen geometries / graphic modes (1..5). */
        if(mod==0){
          const uint16_t old=conctrl_screen_mode;
          conctrl_screen_mode=(uint16_t)mod;
          ++conctrl_calls;
          complete_dos((int32_t)old);
        }
        break;
      }
      if(md==14u){ /* function key row: -1=query; 0..3=set. */
        if(!within(sp,4)) return state=-8;
        const int16_t mod=(int16_t)u16(ram+sp+2);
        if(mod!=-1 && (mod<0 || mod>3))break;
        const uint16_t old=conctrl_fnkeys_mode;
        if(mod!=-1)conctrl_fnkeys_mode=(uint16_t)mod;
        ++conctrl_calls;
        complete_dos((int32_t)old);
        break;
      }
      if(md==17u || md==18u){ /* console cursor ON/OFF, no extra arg. */
        conctrl_cursor_visible=(uint8_t)(md==17u);
        ++conctrl_calls;
        complete_dos(0);
        break;
      }
      /* Other console control modes require real terminal/text-video work.
       * Do not silently consume unsupported controls. */
      break;
    }
#ifdef PWP_EXPERIMENTAL_ZM2
    case 0xff1e: { /* Human68k DOS _FPUTS: output to console handles. */
      if(!tsr_boot_active)break;
      if(!within(sp,6u)){complete_dos(-14);break;}
      const uint32_t str=u32(ram+sp);
      const uint16_t handle=u16(ram+sp+4u);
      if(handle!=1u && handle!=2u){complete_dos(-6);break;}
      if(!within(str,1u)){complete_dos(-14);break;}
      /* Do not read arbitrary guest memory or synthesize terminal output.
       * The actual ZMUSIC.X guest provides the exact string bytes. */
      uint32_t n=0u;
      while(n<65536u && within(str+n,1u) && ram[str+n])n++;
      if(n>=65536u || !within(str+n,1u)){complete_dos(-14);break;}
      for(uint32_t i=0;i<n;i++){
        if(console_length<PWP_CONSOLE_CAP)console_bytes[console_length++]=ram[str+i];
        else console_truncated=1;
      }
      complete_dos(0);break;
    }
    case 0xff81: /* DOS _GETPDB: process descriptor, Human68k 3.x alias. */
    case 0xff51: /* DOS _GETPDB: classic entry. */
      if(!tsr_boot_active)break;
      /* The actual ZMUSIC.X guest was loaded in its own MCB/PSP,
       * which starts 16 bytes after $23FFF0; do not synthesize metadata. */
      complete_dos((int32_t)PWP_TSR_PSP);break;
    case 0xfff7: { /* DOS _BUS_ERR: real bounded memory-access probe/copy. */
      if(!tsr_boot_active)break;
      /* Stack order: P2.l destination, P1.l source, SIZE.w (1/2/4).
       * When a genuine guest address is readable/writable, copy exactly
       * that number of bytes; otherwise report a guest address error.
       * Never map arbitrary MIDI-board, host, or firmware memory. */
      if(!within(sp,10u)){complete_dos(-14);break;}
      const uint32_t dst=u32(ram+sp),src=u32(ram+sp+4u);
      const uint16_t n=u16(ram+sp+8u);
      if((n!=1u&&n!=2u&&n!=4u) ||
         (n!=1u && ((src|dst)&1u)) ||
         !within(src,n)||!within(dst,n)){
        complete_dos(-14);break;
      }
      memmove(ram+dst,ram+src,n);
      complete_dos(0);break;
    }
    case 0xff30: /* DOS _VERNUM: Human68k 3.02 virtual OS version. */
      if(!tsr_boot_active)break;
      complete_dos((int32_t)0x36380302u);break;
    case 0xff31: /* DOS _KEEPPR: real driver must install TRAP #3 first. */
      if(tsr_boot_active) {
        if(!within(sp,6u))return state=-18;
        const uint32_t length=u32(ram+sp);
        const uint16_t code=u16(ram+sp+4u);
        if(code || length>PWP_TSR_END-PWP_TSR_LOAD)return state=-18;
        return pwp_mu_tsr_keeppr(length);
      }
      break;
#endif
    case 0xff00: /* _EXIT: finish process with no error. */
      pan_open=0; pan_pos=0; process_exit_code=0;
      state=4;
      break;
    case 0xff4c: /* _EXIT2(status.w) */
      if (!within(sp,2)) return state=-8;
      process_exit_code=u16(ram+sp);
      pan_open=0; pan_pos=0;
      state=4;
      break;
    case 0xff06: { /* Human68k _INPOUT: FF = nonblocking key input. */
      if((sp&1u)||!within(sp,2))return state=-8;
      const uint16_t code=u16(ram+sp);
      /* PANIC.X V1.38 polls FF06(CODE=$FF) in its own real 68000 code,
       * comparing D0 to the PAN schedule's expected key.  A single
       * SPACE press produces one $20 byte, then the next poll returns 0. */
      if(code!=0x00ffu)break; /* Unsupported console output modes fail closed. */
      const uint32_t c=pwp_space_queued?0x20u:0u;
      if(pwp_space_queued){--pwp_space_queued;++pwp_space_consumed;}
      complete_dos((int32_t)c);
      break;
    }
    case 0xff0c: { /* _KFLUSH: flush pending keyboard input. */
      if (!within(sp,2)) return state=-8;
      const uint16_t mode=u16(ram+sp);
      /* Only the no-input operations are implemented: this runtime has no
       * browser-to-Human68k keyboard queue yet. Human68k flush-only mode
       * $FFFF (documented); PANIC.X V1.38 cleanup pushes MODE=$00FF
       * after CLR.L -(SP), with no keyboard data to return. Validate the
       * exact observed six-byte shape rather than accepting all modes.
       * Modes 1/7/8/10 block for actual keyboard input and must NOT
       * be reported as successful while input is unimplemented. */
      if (mode==0xffffu) { pwp_space_queued=0;complete_dos(0); break; }
      if (mode==0x00ffu) {
        if(!within(sp,6)) return state=-8;
        if(u32(ram+sp+2)==0u){pwp_space_queued=0;complete_dos(0);}
        break; /* Unknown $00FF shapes remain unsupported. */
      }
      if (mode==6u) {
        if(!within(sp,4)) return state=-8;
        if(u16(ram+sp+2)==0x00ffu) complete_dos(0); /* poll: no input */
        break; /* input/output modes require a real keyboard service */
      }
      break;
    }
    case 0xff09: { /* _PRINT: NUL-terminated, bounded guest memory string. */
      if(!within(sp,4))return state=-8;
      const uint32_t str=u32(ram+sp);
      if(!within(str,1)) {complete_dos(-14);break;}
      uint32_t end=str;
      /* Reject runaway unterminated strings, rather than scanning guest RAM
       * or converting an invalid guest pointer into a host read. */
      const uint32_t cap=(PWP_RAM_BYTES-str)<65536u?(PWP_RAM_BYTES-str):65536u;
      while(end-str<cap && ram[end]!=0) ++end;
      if(end-str==cap){complete_dos(-14);break;}
      for(uint32_t pos=str;pos<end;pos++){
        if(console_length<PWP_CONSOLE_CAP)console_bytes[console_length++]=ram[pos];
        else console_truncated=1;
      }
      complete_dos(0);
      break;
    }
    case 0xff25: { /* _INTVCS(vector.w,handler.l) */
      if(!within(sp,6))return state=-8;
      const uint16_t vec=u16(ram+sp);
      const uint32_t new_addr=u32(ram+sp+2);
      /* No host access. Handler must be resident in mapped guest memory,
       * unless 0 is explicitly supplied to clear it. */
      if(new_addr && !within(new_addr,2)) {complete_dos(-14);break;}
      uint32_t old=0;
      if(vec<=255u){
        old=u32(ram+4u*vec);w32(ram+4u*vec,new_addr);
      }else if(vec>=0x100u && vec<=0x1ffu){
        old=iocs_vectors[vec-0x100u];iocs_vectors[vec-0x100u]=new_addr;
      }else if(vec>=0xff00u){
        old=dos_vectors[vec-0xff00u];dos_vectors[vec-0xff00u]=new_addr;
      }else {complete_dos(-14);break;}
      complete_dos((int32_t)old);
      break;
    }
    case 0xff35: { /* _INTVCG(vector.w) */
      if(!within(sp,2))return state=-8;
      const uint16_t vec=u16(ram+sp);
      if(vec<=255u)complete_dos((int32_t)u32(ram+4u*vec));
      else if(vec>=0x100u && vec<=0x1ffu)complete_dos((int32_t)iocs_vectors[vec-0x100u]);
      else if(vec>=0xff00u)complete_dos((int32_t)dos_vectors[vec-0xff00u]);
      else complete_dos(-14);
      break;
    }

    case 0xff4a: /* _SETBLOCK */
      if (!within(sp,8)) return state=-8;
      ptr=u32(ram+sp);requested=u32(ram+sp+4);
      if (ptr!=PWP_LOAD || requested<size_bss-PWP_LOAD || requested>PWP_LIMIT-PWP_LOAD ||
          (alloc_count && PWP_LOAD+requested>allocs[0].hdr)) {
        complete_dos(-8);
      } else {
        w32(ram+PWP_MCB+8,PWP_LOAD+requested);
        complete_dos(0);
      }
      break;
    case 0xff48: /* _MALLOC(size.l) */
      if(!within(sp,4))return state=-8;
#ifdef PWP_EXPERIMENTAL_ZM2
      complete_dos(tsr_boot_active ? pwp_mu_tsr_malloc(u32(ram+sp)) : malloc_guest(u32(ram+sp)));
#else
      complete_dos(malloc_guest(u32(ram+sp)));
#endif
      break;
    case 0xff49: /* _MFREE(ptr.l) */
      if(!within(sp,4))return state=-8;
      complete_dos(free_guest(u32(ram+sp)));
      break;
    case 0xff37: { /* _NAMECK(FILE.l, BUFFER.l), 91-byte result. */
      if(!within(sp,8))return state=-8;
      const uint32_t file=u32(ram+sp);
      const uint32_t buffer=u32(ram+sp+4);
      if(!within(buffer,PWP_NAMECK_BYTES)) {complete_dos(-14);break;}
      uint8_t name[PWP_NAMECK_BYTES];
      int32_t rc=expand_guest_name(file,name);
      if(rc==0)memcpy(ram+buffer,name,sizeof(name));
      complete_dos(rc);
      break;
    }
    case 0xff4e: { /* _FILES(BUFFER.l,FILE.l,ATR.w): one mounted PAN only. */
      if(!within(sp,10))return state=-8;
      const uint32_t buffer=u32(ram+sp);
      const uint32_t file=u32(ram+sp+4);
      const uint16_t attr=u16(ram+sp+8);
      char pattern[256];
      if(!within(buffer,PWP_FILES_BYTES)) {complete_dos(-14);break;}
      if(!guest_virtual_path(file,pattern,sizeof pattern)) {complete_dos(-14);break;}
      if(!pan_mounted || pan_size>0xffffffffull ||
         !virtual_file_match(pattern) || (attr&0x08u)) {
        complete_dos(-18);break;
      }
      uint8_t entry[PWP_FILES_BYTES]={0};
      entry[0]=(uint8_t)attr;
      entry[1]=2; /* C: drive index A=0, B=1, C=2 */
      w16(entry+8,0xffffu); /* This one-file directory has no next entry. */
      memcpy(entry+10,"P68K    ",8);
      memcpy(entry+18,"PAN",3);
      entry[21]=0x20u; /* archive, ordinary read-only virtual PAN */
      w32(entry+26,(uint32_t)pan_size);
      memcpy(entry+30,"P68K.PAN",9);
      memcpy(ram+buffer,entry,sizeof entry);
      complete_dos(0);
      break;
    }
    case 0xff4f: /* _NFILES(BUFFER.l): never enumerate nonexistent files. */
      if(!within(sp,4))return state=-8;
      ptr=u32(ram+sp);
      if(!within(ptr,PWP_FILES_BYTES)){complete_dos(-14);break;}
      complete_dos(-18); /* Human68k: no more matches */
      break;
    case 0xff3d: /* _OPEN(path.l,mode.w) */
      if (!within(sp,6)) return state=-8;
      ptr=u32(ram+sp);
      if (u16(ram+sp+4)!=0) {complete_dos(-12);break;}
      if (!pan_mounted || !pan_path_is_staged(ptr)) {complete_dos(-2);break;}
      if (pan_open) {complete_dos(-4);break;}
      pan_open=1;pan_pos=0;
      ++pwp_pan_open_calls;
      complete_dos(PWP_PAN_HANDLE);
      break;
    case 0xff3e: /* _CLOSE(handle.w) */
      if (!within(sp,2)) return state=-8;
      if (u16(ram+sp)!=PWP_PAN_HANDLE || !pan_open) {complete_dos(-6);break;}
      pan_open=0;pan_pos=0;
      complete_dos(0);
      break;
    case 0xff3f: /* _READ(handle.w, dst.l, n.l) */
      if (!within(sp,10)) return state=-8;
      if (u16(ram+sp)!=PWP_PAN_HANDLE || !pan_open) {complete_dos(-6);break;}
      ptr=u32(ram+sp+2);requested=u32(ram+sp+6);
      if (requested>0x7fffffffu || !within(ptr,requested)) {complete_dos(-22);break;}
      if (!requested) {complete_dos(0);break;} /* Zero-byte _READ succeeds without touching the file. */
      io_dst=ptr;io_total=requested;io_done=0;
      ++pwp_pan_read_calls;
      io_next();
      break;
    case 0xff42: { /* _SEEK(handle.w,offset.l,origin.w) */
      if (!within(sp,8)) return state=-8;
      if (u16(ram+sp)!=PWP_PAN_HANDLE || !pan_open) {complete_dos(-6);break;}
      const int64_t offset=(int32_t)u32(ram+sp+2);
      const uint16_t whence=u16(ram+sp+6);
      uint64_t base;
      if (whence==0) base=0;
      else if (whence==1) base=pan_pos;
      else if (whence==2) base=pan_size;
      else {complete_dos(-22);break;}
      /* Check before casting or adding: base may be > INT64_MAX for an
       * externally supplied large Blob and C signed overflow is UB. */
      if (base>0x7fffffffu) {complete_dos(-25);break;}
      const int64_t target=(int64_t)base+offset;
      /* Human68k _SEEK location error -25, not unrelated DOS -22. */
      if (target<0 || target>0x7fffffffll || (uint64_t)target>pan_size) {complete_dos(-25);break;}
      pan_pos=(uint64_t)target;
      complete_dos((int32_t)target);
      break;
    }
    default:
      /* Unimplemented F-line or IOCS must remain blocked. */
      break;
  }
  return state;
}
/* Execute real Musashi CPU only between observed external calls. No
 * undocumented DOS operation is silently converted to a success. */
int32_t pwp_mu_run(uint32_t max_instructions) {
  if (max_instructions>100000u) max_instructions=100000u;
  for (uint32_t i=0;i<max_instructions && state==1;i++) {
    uint32_t pc=m68k_get_reg(NULL,M68K_REG_PC);
    if (!within(pc,2)) {state=-8;fault_addr=pc;break;}
    uint16_t op=u16(ram+pc);
    if ((op&0xff00u)==0xff00u || op==0x4e4fu) {
      blocked_at=pc;blocked_op=op;state=2;break;
    }
    if ((op&0xf000u)==0xf000u || (op&0xf000u)==0xa000u) {
      blocked_at=pc;blocked_op=op;state=-9;break;
    }
#ifdef PWP_TAB5_MUSASHI
    /* Register writes may have unmasked a prior IPRB pending event;
     * assert IRQ only after the guest has installed its vector. */
    if (pwp_bus_mfp_vdisp_irq_ready() &&
        (ram[0x118u] | ram[0x119u] | ram[0x11au] | ram[0x11bu])) {
      if (!pwp_vdisp_pending) {
        pwp_vdisp_pending=1;
        m68k_set_irq(6);
      }
    } else if (pwp_vdisp_pending) {
      /* Mask/disable can remove the pending hardware source before IACK.
       * Do not leave the old IRQ6 level asserted and spuriously vector. */
      pwp_vdisp_pending=0;
      m68k_set_irq(0);
    }
    const uint32_t acks_before=pwp_vdisp_acks;
#endif
    const uint32_t scanout_before=pwp_scanout_ticks;
    const int used=m68k_execute(1);
    guest_steps++;
    /* Musashi returns elapsed 68000 clock cycles (not instruction count).
     * The V-DISP source is clocked from those actual guest cycles, so a
     * busy-loop cannot freeze virtual video time. */
    pwp_advance_vdisp(used>0?(uint32_t)used:1u);
    pwp_bus_audio_advance_cycles(used>0?(uint32_t)used:1u);
    if(!pwp_bus_dma3_step(used>0?(uint32_t)used:1u,ram,PWP_RAM_BYTES))
      invalid_bus(pwp_bus_dma3_fault_address());
#ifdef PWP_TAB5_MUSASHI
    if (pwp_vdisp_acks!=acks_before) {m68k_set_irq(0);pwp_vdisp_pending=0;}
#endif
    /* FIX23: return to browser at start-of-visible scanout, AFTER the guest
     * ISR has had the blanking interval in which to change displayed pages.
     * IRQ delivery still occurs at the VBlank falling edge above. */
    if (pwp_scanout_ticks!=scanout_before) break;
  }
  return state;
}
uint32_t pwp_mu_register(uint32_t i) {
  if (i<8) return m68k_get_reg(NULL,(m68k_register_t)(M68K_REG_D0+i));
  if (i<16) return m68k_get_reg(NULL,(m68k_register_t)(M68K_REG_A0+i-8));
  /* Read-only CPU status and both stack banks for real _SUPER acceptance. */
  if (i==16) return m68k_get_reg(NULL,M68K_REG_SR);
  if (i==17) return m68k_get_reg(NULL,M68K_REG_USP);
  if (i==18) return m68k_get_reg(NULL,M68K_REG_ISP);
  return 0;
}
uint32_t pwp_mu_conctrl_calls(void) {return conctrl_calls;}
uint32_t pwp_mu_conctrl_screen_mode(void) {return conctrl_screen_mode;}
uint32_t pwp_mu_conctrl_fnkeys_mode(void) {return conctrl_fnkeys_mode;}
uint32_t pwp_mu_conctrl_cursor_visible(void) {return conctrl_cursor_visible;}
uint32_t pwp_mu_audio_serial(void){return adpcm_event_serial;}
uint32_t pwp_mu_audio_kind(void){return adpcm_event_kind;}
uint32_t pwp_mu_audio_chain_addr(void){return adpcm_chain_addr;}
uint32_t pwp_mu_audio_chain_count(void){return adpcm_chain_count;}
uint32_t pwp_mu_audio_mode(void){return adpcm_mode;}
uint32_t pwp_mu_audio_ram_ptr(void){return (uint32_t)(uintptr_t)ram;}
uint32_t pwp_mu_audio_control_calls(void){return adpcm_control_calls;}
/* Chronological real guest ADPCM byte events. -1 means queue empty. */
int32_t pwp_mu_sound_pop(void){return pwp_bus_sound_pop();}
uint32_t pwp_mu_sound_bytes(void){return pwp_bus_sound_bytes();}
uint32_t pwp_mu_sound_overflows(void){return pwp_bus_sound_overflows();}
uint32_t pwp_mu_dma3_bytes_sent(void){return pwp_bus_dma3_bytes_sent();}
uint32_t pwp_mu_dma3_completions(void){return pwp_bus_dma3_completions();}
uint32_t pwp_mu_dma3_register(uint32_t offset){return pwp_bus_dma3_register(offset);}
uint32_t pwp_mu_audio_chain_calls(void){return adpcm_chain_calls;}
uint32_t pwp_mu_iocs_gclr_calls(void){return iocs_gclr_calls;}
uint32_t pwp_mu_iocs_sp_init_calls(void){return iocs_sp_init_calls;}
uint32_t pwp_mu_iocs_sp_on_calls(void){return iocs_sp_on_calls;}
uint32_t pwp_mu_sprite_initialized(void){return pwp_bus_sprite_initialized();}
uint32_t pwp_mu_sprite_display_enabled(void){return pwp_bus_sprite_display_enabled();}
uint32_t pwp_mu_sprite_init_count(void){return pwp_bus_sprite_initializations();}
uint32_t pwp_mu_sprite_enable_count(void){return pwp_bus_sprite_enables();}
uint32_t pwp_mu_cynthia_active_sprites(void){return pwp_bus_cynthia_active_sprites();}
uint32_t pwp_mu_cynthia_disp_gate(void){return pwp_bus_cynthia_disp_gate();}
uint32_t pwp_mu_cynthia_raw_sprite_count(void){return pwp_bus_cynthia_raw_sprite_count();}
uint32_t pwp_mu_cynthia_attr_writes(void){return pwp_bus_cynthia_attr_writes();}
uint32_t pwp_mu_cynthia_pcg_writes(void){return pwp_bus_cynthia_pcg_writes();}
uint32_t pwp_mu_cynthia_palette_writes(void){return pwp_bus_cynthia_palette_writes();}
uint32_t pwp_mu_graphics_display_enabled(void){return pwp_bus_graphics_display_enabled();}
uint32_t pwp_mu_graphics_clear_count(void){return pwp_bus_graphics_clear_count();}
uint32_t pwp_mu_graphics_access_page(void){return pwp_bus_graphics_page();}
uint32_t pwp_mu_iocs_crtmod_calls(void){return iocs_crtmod_calls;}
uint32_t pwp_mu_iocs_crt_mode(void){return iocs_crt_mode;}
uint32_t pwp_mu_iocs_tgusemd_calls(void) {return iocs_tgusemd_calls;}
uint32_t pwp_mu_iocs_graphics_use(void) {return iocs_screen_uses[0];}
uint32_t pwp_mu_iocs_text_use(void) {return iocs_screen_uses[1];}
uint32_t pwp_mu_iocs_last_d1(void) {return iocs_last_call_d1;}
uint32_t pwp_mu_iocs_last_d2(void) {return iocs_last_call_d2;}
uint32_t pwp_mu_iocs_ms_init_calls(void) {return iocs_ms_init_calls;}
uint32_t pwp_mu_mouse_initialized(void) {return mouse_initialized;}
uint32_t pwp_mu_mouse_cursor_visible(void) {return mouse_cursor_visible;}
uint32_t pwp_mu_pc(void) {return m68k_get_reg(NULL,M68K_REG_PC);}
uint32_t pwp_mu_steps(void) {return guest_steps;}
int32_t pwp_mu_status(void) {return state;}
uint32_t pwp_mu_trap(void) {return blocked_op;}
uint32_t pwp_mu_trap_pc(void) {return blocked_at;}
uint32_t pwp_mu_fault_address(void) {return fault_addr;}
uint32_t pwp_mu_image_end(void) {return size_image;}
uint32_t pwp_mu_bss_end(void) {return size_bss;}
uint32_t pwp_mu_guest_peek8(uint32_t a) {return within(a,1)?ram[a]:256u;}
uint32_t pwp_mu_guest_peek32(uint32_t a) {return (!(a&1u) && within(a,4))?u32(ram+a):0;}
uint32_t pwp_mu_console_length(void){return console_length;}
uint32_t pwp_mu_console_byte(uint32_t index){return index<console_length?console_bytes[index]:0;}
uint32_t pwp_mu_console_truncated(void){return console_truncated;}
uint32_t pwp_mu_exit_code(void){return process_exit_code;}
uint32_t pwp_mu_pan_read_calls(void){return pwp_pan_read_calls;}
uint32_t pwp_mu_pan_open_calls(void){return pwp_pan_open_calls;}
uint32_t pwp_mu_pan_bytes_low(void){return (uint32_t)pwp_pan_bytes_supplied;}
uint32_t pwp_mu_pan_bytes_high(void){return (uint32_t)(pwp_pan_bytes_supplied>>32);}
uint32_t pwp_mu_pan_open(void){return (uint32_t)pan_open;}
uint32_t pwp_mu_last_dos_op(void){return pwp_last_dos_op;}
uint32_t pwp_mu_last_dos_pc(void){return pwp_last_dos_pc;}
int32_t pwp_mu_last_dos_return(void){return pwp_last_dos_return;}
uint32_t pwp_mu_pan_error_op(void){return pwp_pan_error_op;}
int32_t pwp_mu_pan_error_code(void){return pwp_pan_error_code;}
uint32_t pwp_mu_pan_error_count(void){return pwp_pan_error_count;}


/* These expose real guest VIDEO memory, not a claim of decoded PAN frames. */
uint32_t pwp_mu_video_text_index(uint32_t x,uint32_t y){return pwp_bus_text_index(x,y);}
uint32_t pwp_mu_video_palette_word(uint32_t idx,uint32_t text){return pwp_bus_palette_word(idx,(int)text);}
uint32_t pwp_mu_video_write_count(void){return pwp_bus_video_writes();}
uint32_t pwp_mu_video_pixel_writes(void){return pwp_bus_pixel_mutations();}
/* FIX15: diagnostics read authoritative guest CRTC/VC state, never override it. */
uint32_t pwp_mu_video_crtc_reg(uint32_t index){return pwp_bus_crtc_register(index);}
uint32_t pwp_mu_video_crtc_changes(void){return pwp_bus_crtc_changed_writes();}
uint32_t pwp_mu_video_vctrl_r2(void){return pwp_bus_vctrl_r2();}
uint32_t pwp_mu_video_vctrl_r1(void){return pwp_bus_vctrl_r1();}

uint32_t pwp_mu_video_graphic_word(uint32_t x,uint32_t y){return pwp_bus_graphic_word(x,y);}

uint32_t pwp_mu_mfp_ierb_reads(void){return pwp_bus_mfp_ierb_reads();}
uint32_t pwp_mu_mfp_imrb_reads(void){return pwp_bus_mfp_imrb_reads();}
uint32_t pwp_mu_mfp_last_read_address(void){return pwp_bus_mfp_last_read_address();}
