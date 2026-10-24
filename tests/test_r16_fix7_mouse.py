"""Mouse interface behavior in C, plus strict real-CPU/WASM acceptance gates."""
from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class MouseInit(unittest.TestCase):
 def test_live_c_mock_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   exe=Path(d)/'mouse_test'
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror',
        '-fsanitize=undefined','-fno-sanitize-recover=all',
        '-I',str(R/'tests/mock'),'-I',str(R/'core'),'-DPWP_TEST_STAGE',
        str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
        str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),
        str(R/'tests/mock/test_r16_fix7_mouse.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,text=True,capture_output=True)
   r=subprocess.run([str(exe)],check=True,text=True,capture_output=True)
   self.assertIn('PASS R16 FIX7 IOCS $70 _MS_INIT',r.stdout)
 def test_real_original_musashi_gate_required(self):
  t=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn("invoke([node,ROOT/'tools'/'RUN_R16_FIX7_MSINIT_CPU.mjs',out,x])",t)
  self.assertIn("'mouse_gate':'REAL_MUSASHI_WASM_PANIC_MS_INIT_PASS'",t)
  self.assertIn('PANIC.X IOCS $70 _MS_INIT in WASM',t)
  report=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn("info.get('mouse_gate')!='REAL_MUSASHI_WASM_PANIC_MS_INIT_PASS'",report)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',report)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',(R/'RUN_THIS_R16_FIX17R3_ONEPASS.cmd').read_text())
 def test_real_wasm_gate_checks_original_70_location_and_nonfake_media(self):
  s=(R/'tools/RUN_R16_FIX7_MSINIT_CPU.mjs').read_text()
  for word in ['0x10090','0x10092','f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd',
               '_pwp_mu_iocs_ms_init_calls','_pwp_mu_mouse_initialized',
               '_pwp_mu_video_pixel_writes','panFrameVerified:false']:
   self.assertIn(word,s)
 def test_report_includes_mouse_and_fails_closed_on_unimplemented(self):
  tr=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  for word in ('iocsMsInitCalls','mouseInitialized','mouseCursorVisible',
               'firstUnimplementedIocsFunction','firstVisibleFrameIsNotDecodeProof'):
   self.assertIn(word,tr)
  s=(R/'core/pwp_musashi.c').read_text()
  self.assertIn('if(fn!=0x0eu) return state;',s)
  self.assertIn('if(fn==0x70u)',s)
  self.assertIn('++iocs_ms_init_calls;',s)
  self.assertNotIn('if(fn==0x71u)',s)
if __name__=='__main__':unittest.main()
