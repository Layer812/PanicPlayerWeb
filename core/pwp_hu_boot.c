/* Panic Player Web R3: bounded, explicitly INCOMPLETE 68000 startup executor.
 * This is a verified HU loader and a deliberately tiny CPU smoke-test only,
 * NOT Musashi and NOT a playable PANIC runtime.
 * The target executable is the original PANIC.X V1.38, run from HU text base.
 * SPDX-License-Identifier: MIT (this new adapter only)
 */
#include <stdint.h>
#include <stddef.h>
/* Compiler libcalls are supplied locally in the freestanding WASM module. */
void *memset(void *p, int v, size_t n) { uint8_t *d = (uint8_t*)p; for (size_t i=0;i<n;i++) d[i]=(uint8_t)v; return p; }
void *memcpy(void *p, const void *q, size_t n) { uint8_t *d = (uint8_t*)p; const uint8_t *s=(const uint8_t*)q; for (size_t i=0;i<n;i++) d[i]=s[i]; return p; }

#define GUEST_BYTES (4u * 1024u * 1024u)
#define STAGING_BYTES (1024u * 1024u)
#define LOAD_BASE 0x10000u
#define HEADER_SIZE 0x40u

static uint8_t guest[GUEST_BYTES];
static uint8_t staging[STAGING_BYTES];
static uint32_t D[8], A[8], PC;
static uint32_t image_end, bss_end, steps, trap_opcode;
static int32_t status; /* 0 reset, 1 loaded/running, 2 DOS/F-line trap, negatives are errors */
static uint32_t fault_pc, fault_opcode;

static uint16_t be16(const uint8_t *p) { return ((uint16_t)p[0] << 8) | p[1]; }
static uint32_t be32(const uint8_t *p) { return ((uint32_t)be16(p) << 16) | be16(p + 2); }
static void store32(uint8_t *p, uint32_t x) {
    p[0] = (uint8_t)(x >> 24); p[1] = (uint8_t)(x >> 16);
    p[2] = (uint8_t)(x >> 8); p[3] = (uint8_t)x;
}
static uint32_t bound_read16(uint32_t addr) {
    return addr + 1 < GUEST_BYTES ? be16(guest + addr) : 0;
}
static void fail_at(int32_t code, uint32_t op, uint32_t at) {
    status = code; fault_pc = at; fault_opcode = op;
}

void pwp_hu_reset(void) {
    /* Zero the allocated guest address space and all CPU visible state. */
    for (uint32_t i = 0; i < GUEST_BYTES; ++i) guest[i] = 0;
    for (int i = 0; i < 8; ++i) { D[i] = 0; A[i] = 0; }
    PC = image_end = bss_end = steps = trap_opcode = fault_pc = fault_opcode = 0;
    status = 0;
}
uint32_t pwp_hu_stage_ptr(void) { return (uint32_t)(uintptr_t)staging; }
uint32_t pwp_hu_stage_capacity(void) { return STAGING_BYTES; }

/* HU files require a *real* DOS/IOCS implementation for further execution.
 * Validate all image bounds and reject relocations until correctly supported.
 * No partial loading is committed upon validation failure. */
int32_t pwp_hu_load(uint32_t n) {
    pwp_hu_reset();
    if (n < HEADER_SIZE || n > STAGING_BYTES) { status = -1; return status; }
    if (staging[0] != 'H' || staging[1] != 'U') { status = -2; return status; }
    const uint32_t base = be32(staging + 4);
    const uint32_t entry = be32(staging + 8);
    const uint32_t text = be32(staging + 12);
    const uint32_t data = be32(staging + 16);
    const uint32_t bss = be32(staging + 20);
    const uint32_t reloc = be32(staging + 24);
    const uint32_t symbols = be32(staging + 28);
    const uint64_t initialized = (uint64_t)text + data;
    const uint64_t required = (uint64_t)HEADER_SIZE + initialized + reloc + symbols;
    const uint64_t needed = (uint64_t)LOAD_BASE + initialized + bss;
    if (base != 0 || !text || required > n || needed > GUEST_BYTES || entry >= initialized) {
        status = -3; return status;
    }
    if (reloc != 0) { status = -4; return status; }
    for (uint32_t i = 0; i < (uint32_t)initialized; ++i) guest[LOAD_BASE + i] = staging[HEADER_SIZE + i];
    image_end = LOAD_BASE + (uint32_t)initialized;
    bss_end = image_end + bss;
    PC = LOAD_BASE + entry;
    /* Caller must supply legal Human68k initial A0/A1 and PSP in a real port.
     * Chosen values are deterministic for startup instruction verification. */
    A[0] = 0x20000u;
    A[1] = 0x21000u;
    A[7] = 0x3F0000u;
    status = 1;
    return status;
}

/* One interpreter step, only for instructions verified in PANIC.X startup.
 * -5 unsupported opcode; -6 invalid memory. Status 2 is an unhandled DOS F-line
 * trap, never interpreted as success or a real BIOS/DOS call. */
int32_t pwp_hu_step(void) {
    if (status != 1) return status;
    const uint32_t at = PC;
    if (PC + 1 >= GUEST_BYTES) { fail_at(-6, 0, at); return status; }
    const uint16_t op = (uint16_t)bound_read16(PC);
    PC += 2;
    if ((op & 0xF1FFu) == 0x41FAu) { /* LEA (d16,PC),An */
        if (PC + 1 >= GUEST_BYTES) { fail_at(-6, op, at); return status; }
        const int32_t disp = (int16_t)bound_read16(PC);
        const uint32_t target = PC + (uint32_t)disp; /* 68000 PC-relative = displacement word address */
        PC += 2;
        A[(op >> 9) & 7u] = target;
    } else if ((op & 0xF1F8u) == 0x41E8u) { /* LEA (d16,Am),An */
        if (PC + 1 >= GUEST_BYTES) { fail_at(-6, op, at); return status; }
        const int32_t disp = (int16_t)bound_read16(PC);
        PC += 2;
        A[(op >> 9) & 7u] = A[op & 7u] + (uint32_t)disp;
    } else if ((op & 0xF1F8u) == 0x91C8u) { /* SUBA.L Am,An */
        A[(op >> 9) & 7u] -= A[op & 7u];
    } else if ((op & 0xFFF8u) == 0x2F08u) { /* MOVE.L Am,-(A7) */
        if (A[7] < 4 || A[7] > GUEST_BYTES) { fail_at(-6, op, at); return status; }
        A[7] -= 4;
        store32(guest + A[7], A[op & 7u]);
    } else if ((op & 0xF000u) == 0xF000u) { /* Human68k F-line DOS entry */
        trap_opcode = op;
        status = 2;
        fault_pc = at;
    } else {
        fail_at(-5, op, at);
    }
    steps++;
    return status;
}
int32_t pwp_hu_run(uint32_t budget) {
    if (budget > 100000u) budget = 100000u;
    for (uint32_t i = 0; i < budget && status == 1; ++i) pwp_hu_step();
    return status;
}
uint32_t pwp_hu_register(uint32_t index) {
    return index < 8u ? D[index] : (index < 16u ? A[index - 8u] : 0);
}
uint32_t pwp_hu_pc(void) { return PC; }
uint32_t pwp_hu_steps(void) { return steps; }
uint32_t pwp_hu_status(void) { return (uint32_t)status; }
uint32_t pwp_hu_image_end(void) { return image_end; }
uint32_t pwp_hu_bss_end(void) { return bss_end; }
uint32_t pwp_hu_trap_opcode(void) { return trap_opcode; }
uint32_t pwp_hu_fault_pc(void) { return fault_pc; }
uint32_t pwp_hu_fault_opcode(void) { return fault_opcode; }
uint32_t pwp_hu_guest_peek32(uint32_t address) {
    return address <= GUEST_BYTES - 4 ? be32(guest + address) : 0;
}
