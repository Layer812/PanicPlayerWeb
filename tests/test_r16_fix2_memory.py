"""Regression: the authentic PANIC.X startup needs free memory after SETBLOCK.
This uses the real production adapter + video bus, but a MOCK m68k CPU.
"""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class R16Fix2Memory(unittest.TestCase):
    def test_human68k_a1_and_malloc_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            exe=Path(tmp)/'fix2_memory'
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-DPWP_TEST_STAGE','-I',str(ROOT/'tests/mock'),
                 *map(str,[ROOT/'core/pwp_musashi.c',ROOT/'core/pwp_x68k_video_bus.c',
                           ROOT/'tests/mock/mock_m68k.c',ROOT/'tests/mock/test_r16_fix2_startup_memory.c']),
                 '-o',str(exe)]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            result=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
            self.assertIn('PASS R16 FIX2 HU A1=PROGRAM_END',result.stdout)
    def test_upstream_memory_contract_remains_visible(self):
        c=(ROOT/'core/pwp_musashi.c').read_text(encoding='utf-8')
        self.assertIn('m68k_set_reg(M68K_REG_A1,size_bss)',c)
        self.assertIn('w32(ram+PWP_MCB+8, PWP_LIMIT)',c)
        self.assertIn('w32(ram+PWP_MCB+8,PWP_LOAD+requested)',c)
        self.assertNotIn('m68k_set_reg(M68K_REG_A1,PWP_LIMIT)',c)
    def test_real_cpu_gate_cannot_pass_without_256k_allocation(self):
        boot=(ROOT/'tools/RUN_R9_PANIC_BOOT.mjs').read_text(encoding='utf-8')
        native=(ROOT/'tools/RUN_R13_NATIVE_CPU.py').read_text(encoding='utf-8')
        deep=(ROOT/'tools/RUN_R16_PANIC_DEEP.mjs').read_text(encoding='utf-8')
        self.assertIn('real PANIC.X 256KiB workspace must succeed',boot)
        self.assertIn('genuine PANIC.X workspace allocation failed',native)
        for token in ('malloc256kSucceeded','programEnd','processMCBEndBefore','setblockBytes','mallocRequested'):
            self.assertIn(token,deep)
        runner=(ROOT/'tools/RUN_R16_ONEPASS.py').read_text(encoding='utf-8')
        self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',runner)
if __name__=='__main__':unittest.main()
