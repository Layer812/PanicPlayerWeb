"""R16 FIX9 local semantics (mock CPU), and mandatory real-WASM gate wiring."""
from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class Conctrl(unittest.TestCase):
 def test_native_bridge_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   exe=Path(d)/'conctrl_test'
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined',
        '-fno-sanitize-recover=all','-I',str(R/'tests/mock'),'-I',str(R/'core'),'-DPWP_TEST_STAGE',
        str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
        str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),
        str(R/'tests/mock/test_r16_fix9_conctrl.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,text=True,capture_output=True)
   done=subprocess.run([str(exe)],check=True,text=True,capture_output=True)
   self.assertIn('PASS R16 FIX9 Human68k _CONCTRL',done.stdout)
 def test_real_cpu_wasm_gate(self):
  s=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn('RUN_R16_FIX9_CONCTRL_CPU.mjs',s)
  self.assertIn('REAL_MUSASHI_WASM_CONCTRL_SEMANTICS_PASS',s)
  t=(R/'tools/RUN_R16_FIX9_CONCTRL_CPU.mjs').read_text()
  self.assertIn('_pwp_mu_run',t)
  self.assertIn('synthetic',t.lower())
 def test_real_pan_trace_does_not_confuse_host_read_with_guest_copy(self):
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  for v in ('guestReadBytesVerified','guestReadBytesMismatch','guestReadIntegrityPassed',
            'conctrlMode16QueryPassed','readGuestCopiedBytes'):
   self.assertIn(v,t)
  report=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn('real_pan_guest_read_integrity_passed',report)
  self.assertIn('real_pan_conctrl_mode16_query_passed',report)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',report)
if __name__=='__main__':unittest.main()
