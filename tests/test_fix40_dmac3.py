"""R16 FIX40 HD63450 DMA channel 3 readback / fail-closed start regression."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
class DMAC3RegisterTest(unittest.TestCase):
    def test_native_dmac3_registers(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-DPWP_TEST_STAGE','-I',str(ROOT/'core'),
                 str(ROOT/'core/pwp_x68k_video_bus.c'),
                 str(ROOT/'tests/mock/test_fix40_dmac3.c'),'-o',tmp+'/check']
            subprocess.run(cmd,check=True,capture_output=True)
            output=subprocess.run([tmp+'/check'],capture_output=True,text=True)
            self.assertEqual(output.returncode,0,output.stderr)
            self.assertIn('PASS FIX40',output.stdout)
