"""FIX41 native bus semantics: SysPort contrast and YM2151 select port."""
from pathlib import Path
import subprocess, tempfile, unittest
R=Path(__file__).resolve().parents[1]
class SysportOPM(unittest.TestCase):
 def test_real_mmio_native(self):
  with tempfile.TemporaryDirectory() as d:
   cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
       '-fsanitize=undefined','-fno-sanitize-recover=all',
       '-DPWP_TEST_STAGE','-I',str(R/'core'),str(R/'core/pwp_x68k_video_bus.c'),
       str(R/'tests/mock/test_fix41_sysport_opm.c'),'-o',d+'/test']
   subprocess.run(cmd,check=True,capture_output=True)
   v=subprocess.run([d+'/test'],capture_output=True,text=True)
   self.assertEqual(v.returncode,0,v.stderr)
   self.assertIn('PASS FIX41',v.stdout)
