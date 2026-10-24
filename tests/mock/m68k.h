/* Test-only ABI declaration. NOT a CPU emulator; never bundled into WASM. */
#ifndef PWP_TEST_M68K_H
#define PWP_TEST_M68K_H
#define M68K_CPU_TYPE_68000 1
typedef enum {
 M68K_REG_D0=0,M68K_REG_D1,M68K_REG_D2,M68K_REG_D3,M68K_REG_D4,M68K_REG_D5,M68K_REG_D6,M68K_REG_D7,
 M68K_REG_A0,M68K_REG_A1,M68K_REG_A2,M68K_REG_A3,M68K_REG_A4,M68K_REG_A5,M68K_REG_A6,M68K_REG_A7,
 M68K_REG_PC,M68K_REG_SR,M68K_REG_USP,M68K_REG_ISP
} m68k_register_t;
void m68k_init(void);
void m68k_set_cpu_type(unsigned int);
void m68k_pulse_reset(void);
void m68k_set_reg(m68k_register_t,unsigned int);
unsigned int m68k_get_reg(void*,m68k_register_t);
int m68k_execute(int);
void m68k_end_timeslice(void);
void m68k_set_irq(unsigned int level);
#endif
