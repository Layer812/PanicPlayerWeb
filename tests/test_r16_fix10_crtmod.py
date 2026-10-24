"""FIX10 native mock semantics + genuine Musashi 68000 WASM acceptance wiring."""
from pathlib import Path
import tempfile,subprocess,unittest
R=Path(__file__).resolve().parents[1]
class Fix10(unittest.TestCase):
 def test_crtmod_mock_c_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined',
    '-fno-sanitize-recover=all','-I',str(R/'tests/mock'),'-I',str(R/'core'),'-DPWP_TEST_STAGE',
    str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
    str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),
    str(R/'tests/mock/test_r16_fix10_crtmod.c'),'-o',d+'/crtmod']
   subprocess.run(cmd,check=True,text=True,capture_output=True)
   p=subprocess.run([d+'/crtmod'],check=True,text=True,capture_output=True)
   self.assertIn('PASS FIX10 IOCS CRTMOD',p.stdout)
 def test_real_cpu_gate(self):
  build=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  test=(R/'tools/RUN_R16_FIX10_CRTMOD_CPU.mjs').read_text()
  runner=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn('RUN_R16_FIX10_CRTMOD_CPU.mjs',build)
  self.assertIn('REAL_MUSASHI_WASM_CRTMOD10_SEMANTICS_PASS',build)
  self.assertIn('_pwp_mu_run',test)
  self.assertIn('rejectedMode11:true',test)
  self.assertIn('crtmod_gate',runner)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',runner)
 def test_real_pan_io_and_gate_trace(self):
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  self.assertIn('panicCrtmod10Passed',t)
  self.assertIn('crtModeArgument',t)
  self.assertIn('guestReadIntegrityPassed',t)
  s=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn('real_pan_panic_crtmod10_passed',s)
  self.assertIn('actual_pan_frame_verified',s)
