"""R16 FIX4 supervisor mode bridge verification. NOT real 68000 emulation."""
import unittest
import subprocess
import tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]
class SuperContract(unittest.TestCase):
    def test_mock_super_switch_and_stack_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            exe=Path(d)/'super'
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-DPWP_TEST_STAGE','-I',str(R/'tests/mock'),
                 *map(str,[R/'core/pwp_musashi.c',R/'core/pwp_x68k_video_bus.c',
                           R/'tests/mock/mock_m68k_super.c',R/'tests/mock/test_r16_fix4_super.c']),
                 '-o',str(exe)]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            res=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
            self.assertIn('PASS R16 FIX4 DOS _SUPER',res.stdout)
    def test_real_cpu_build_requires_super_gate(self):
        source=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
        self.assertIn('RUN_R16_FIX4_SUPER_CPU.mjs',source)
        script=(R/'tools/RUN_R16_FIX4_SUPER_CPU.mjs').read_text()
        for token in ('REAL_MUSASHI_WASM_PANIC_SUPER_PASS','REAL_MUSASHI_WASM_SUPER_ROUNDTRIP_PASS',
                      '0x10044','0x10046','0x10048','_pwp_mu_register(18)'):
            self.assertIn(token,script)
    def test_no_bypass_or_fake_super(self):
        s=(R/'core/pwp_musashi.c').read_text()
        self.assertIn('M68K_REG_USP',s)
        self.assertIn('M68K_REG_ISP',s)
        self.assertIn('m68k_set_reg(M68K_REG_SR,sr|0x2000u)',s)
        self.assertIn('m68k_set_reg(M68K_REG_SR,sr&~0x2000u)',s)
        self.assertNotIn('case 0xff20: complete_dos(0)',s)
    def test_report_and_realpan_super_trace(self):
        report=(R/'tools/RUN_R16_ONEPASS.py').read_text()
        self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',report)
        trace=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
        for token in ('supervisorSwitches','srBefore','srAfter','uspBefore','ispAfter'):
            self.assertIn(token,trace)
if __name__=='__main__':unittest.main()
