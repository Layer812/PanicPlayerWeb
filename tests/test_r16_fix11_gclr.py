"""FIX11 native/UBSan and real-CPU gate integration tests."""
from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class Gclr(unittest.TestCase):
 def test_native_mock_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined',
     '-fno-sanitize-recover=all','-DPWP_TEST_STAGE','-I',str(R/'tests/mock'),'-I',str(R/'core'),
      str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),str(R/'core/pwp_x68k_frame.c'),
      str(R/'tests/mock/mock_m68k_super.c'),str(R/'tests/mock/test_r16_fix11_gclr.c'),'-o',d+'/gclr']
   c=subprocess.run(cmd,capture_output=True,text=True)
   self.assertEqual(c.returncode,0,c.stdout+c.stderr)
   p=subprocess.run([d+'/gclr'],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stdout+p.stderr)
   self.assertIn('PASS FIX11 IOCS G_CLR_ON',p.stdout)
 def test_real_musashi_gate_wired(self):
  b=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  r=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  t=(R/'tools/RUN_R16_FIX11_GCLR_CPU.mjs').read_text()
  e=(R/'tools/BUILD_R9_MUSASHI.py').read_text()
  self.assertIn('RUN_R16_FIX11_GCLR_CPU.mjs',b)
  self.assertIn('REAL_MUSASHI_WASM_GCLR_ON10_SEMANTICS_PASS',b)
  self.assertIn("info.get('gclr_gate')",r)
  self.assertIn('_pwp_mu_run(1)',t)
  for sym in ['pwp_mu_iocs_gclr_calls','pwp_mu_graphics_display_enabled','pwp_mu_graphics_clear_count']:
   self.assertIn("'"+sym+"'",e)
 def test_authentic_movie_gate_distinct_from_pixel_appearance(self):
  s=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  self.assertIn("pc==='0x012c8a'",s)
  self.assertIn('panicGclrOnPassed',s)
  self.assertIn('graphicsClearsAfter',s)
  self.assertIn('firstVisibleFrameIsNotDecodeProof=true',s)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',(R/'tools/RUN_R16_ONEPASS.py').read_text())
