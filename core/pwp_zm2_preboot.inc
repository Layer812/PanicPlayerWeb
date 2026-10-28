/* Experimental real Musashi Z-MUSIC preboot. Included in pwp_musashi.c only
 * with PWP_EXPERIMENTAL_ZM2. This is NOT linked into public Pages.
 * The guest executes genuine HU instructions; no RTE stub, no fake signature.
 * Do not expose to browser until actual ZMUSIC208.X boot and timers work.
 */
static uint32_t pwp_tsr_align(uint32_t n){return (n+15u)&~15u;}
uint32_t pwp_mu_tsr_phase(void){return tsr_boot_active?1u:tsr_status;}
uint32_t pwp_mu_tsr_steps(void){return tsr_steps;}
int32_t pwp_mu_tsr_begin(uint32_t n){
  if(tsr_boot_active||tsr_status||state!=1||guest_steps||pan_mounted||
     n<64u||n>PWP_HU_CAP||size_bss>=PWP_TSR_MCB)return -30;
  const unsigned context_size=m68k_context_size();
  if(!context_size || context_size>sizeof(tsr_saved_context))return -31;
  /* Reuses the verified R10 HU relocation loader, not executable bytes
   * supplied as raw callbacks or JavaScript-generated guest opcodes. */
  pwp_hu_image image={0};
  if(!pwp_hu_stage(stage,n,ram+PWP_TSR_LOAD,PWP_TSR_END-PWP_TSR_LOAD,
                   PWP_TSR_LOAD,&image))return -32;
  if(image.end_address>=PWP_TSR_END-64u)return -32;
  tsr_context_bytes=m68k_get_context(tsr_saved_context);
  if(tsr_context_bytes!=context_size)return -31;
  tsr_saved_cycles=pwp_guest_cycles;
  tsr_saved_vdisp=pwp_next_vdisp;
  tsr_saved_scanout=pwp_next_scanout;
  tsr_saved_ticks=pwp_vdisp_ticks;
  tsr_saved_scans=pwp_scanout_ticks;
  tsr_saved_acks=pwp_vdisp_acks;
  tsr_heap=pwp_tsr_align(image.end_address);
  /* Guest Human68k PSP/MCB for a separate child at a non-overlapping address.
   * The primary PANIC.X image/CPU context stays intact. No generic host FS. */
  w32(ram+PWP_TSR_MCB+0u,PWP_MCB);
  w32(ram+PWP_TSR_MCB+4u,PWP_TSR_MCB);
  w32(ram+PWP_TSR_MCB+8u,PWP_TSR_END);
  w32(ram+PWP_TSR_MCB+12u,0);
  w32(ram+PWP_MCB+8u,PWP_TSR_MCB);
  w32(ram+PWP_MCB+12u,PWP_TSR_MCB);
  ram[PWP_TSR_CMD]=0u;
  ram[PWP_TSR_CMD+1u]=0u;
  /* Human68k _GETPDB returns the process descriptor, NOT the executable.
   * Z-MUSIC follows PDB[0] -> environment block and starts reading at
   * env+4. A genuine empty environment has a zero byte there. */
  memset(ram+PWP_TSR_ENV,0,256u);
  memset(ram+PWP_TSR_PSP,0,256u);
  w32(ram+PWP_TSR_PSP,PWP_TSR_ENV);
  m68k_set_reg(M68K_REG_SR,0x2000u);
  m68k_set_reg(M68K_REG_A0,PWP_TSR_MCB);
  m68k_set_reg(M68K_REG_A1,image.end_address);
  m68k_set_reg(M68K_REG_A2,PWP_TSR_CMD);
  m68k_set_reg(M68K_REG_A3,0xffffffffu);
  m68k_set_reg(M68K_REG_A4,image.entry_address);
  m68k_set_reg(M68K_REG_USP,PWP_TSR_STACK);
  m68k_set_reg(M68K_REG_ISP,PWP_TSR_STACK);
  m68k_set_reg(M68K_REG_A7,PWP_TSR_STACK);
  m68k_set_reg(M68K_REG_SR,0);
  m68k_set_reg(M68K_REG_PC,image.entry_address);
  tsr_boot_active=1;
  tsr_status=0;
  tsr_steps=0;
  return state=1;
}
/* Boot-time driver heap is strictly inside the private reserved region;
 * the main PANIC.X allocator uses its existing block list only after
 * the actual _KEEPPR. No host-side malloc is exposed to the guest. */
static int32_t pwp_mu_tsr_malloc(uint32_t n){
  if(n==0xffffffffu)return (int32_t)(PWP_TSR_END-tsr_heap-16u);
  if(!n || n>0x100000u || n>UINT32_MAX-31u)return -8;
  uint32_t size=pwp_tsr_align(n);
  if(tsr_heap>PWP_TSR_END || size>PWP_TSR_END-tsr_heap ||
     16u>PWP_TSR_END-tsr_heap-size)return -8;
  const uint32_t block=tsr_heap;
  tsr_heap+=16u+size;
  w32(ram+block+0u,PWP_TSR_MCB);
  w32(ram+block+4u,PWP_TSR_MCB);
  w32(ram+block+8u,tsr_heap);
  w32(ram+block+12u,0);
  return (int32_t)(block+16u);
}
static int32_t pwp_mu_tsr_keeppr(uint32_t bytes){
  if(!tsr_boot_active || !tsr_context_bytes ||
     !bytes || bytes>PWP_TSR_END-PWP_TSR_LOAD)return state=-18;
  /* This is a mandatory genuine driver sign-off, not a manufactured ID.
   * The TRAP #3 vector and ZmuSiC signature must have been written by
   * the guest while its 68000 instructions were actually running. */
  if(!pwp_zm2_guest_resident(ram,PWP_RAM_BYTES))return state=-19;
  /* Keep the reserved driver + private work heap out of PANIC's future
   * _MALLOC span. The actual guest vectors and RAM are not reset. */
  allocs[0].hdr=PWP_TSR_MCB;
  allocs[0].end=PWP_TSR_END;
  alloc_count=1u;
  relink_blocks();
  tsr_steps=guest_steps;
  guest_steps=0u;
  pwp_guest_cycles=tsr_saved_cycles;
  pwp_next_vdisp=tsr_saved_vdisp;
  pwp_next_scanout=tsr_saved_scanout;
  pwp_vdisp_ticks=tsr_saved_ticks;
  pwp_scanout_ticks=tsr_saved_scans;
  pwp_vdisp_acks=tsr_saved_acks;
  blocked_at=0u;blocked_op=0u;
  m68k_set_context(tsr_saved_context);
  tsr_boot_active=0;
  tsr_status=2u;
  return state=1;
}
