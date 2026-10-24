from pathlib import Path
import subprocess, tempfile, unittest
R=Path(__file__).resolve().parents[1]
class Sprite(unittest.TestCase):
 def test_native_mock_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all','-DPWP_TEST_STAGE','-I',str(R/'tests/mock'),'-I',str(R/'core'),str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),str(R/'tests/mock/test_r16_fix12_sprite.c'),'-o',d+'/sprite']
   r=subprocess.run(cmd,capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   p=subprocess.run([d+'/sprite'],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stdout+p.stderr)
   self.assertIn('PASS FIX12 sprite/BG IOCS',p.stdout)
 def test_wasm_gate_and_trace_are_wired(self):
  b=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  r=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  e=(R/'tools/BUILD_R9_MUSASHI.py').read_text()
  self.assertIn('RUN_R16_FIX12_SPRITE_CPU.mjs',b)
  self.assertIn('REAL_MUSASHI_WASM_SPRITE_INIT_ON10_SEMANTICS_PASS',b)
  self.assertIn("info.get('sprite_gate')",r)
  self.assertIn('panicSpInitPassed',t)
  self.assertIn('panicSpOnPassed',t)
  self.assertIn('0x012c8e',t)
  self.assertIn('0x012c92',t)
  for name in ['pwp_mu_iocs_sp_init_calls','pwp_mu_iocs_sp_on_calls','pwp_mu_sprite_initialized','pwp_mu_sprite_display_enabled']:
   self.assertIn("'"+name+"'",e)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',r)
