"""Real C glue ABI test using a CPU mock, never presented as Musashi execution."""
import subprocess,tempfile,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
class TestIocs(unittest.TestCase):
 def test_real_c_adapter_mock(self):
  with tempfile.TemporaryDirectory() as d:
   exe=Path(d)/'iocs_test'
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all',
        '-I',str(R/'tests/mock'),'-I',str(R/'core'),'-DPWP_TEST_STAGE',
        str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),str(R/'core/pwp_x68k_frame.c'),
        str(R/'tests/mock/mock_m68k_super.c'),str(R/'tests/mock/test_r16_fix6_iocs.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,text=True,capture_output=True)
   r=subprocess.run([str(exe)],check=True,text=True,capture_output=True)
   self.assertIn('PASS R16 FIX6',r.stdout)
 def test_real_cpu_gate_mandatory(self):
  b=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn("invoke([node,ROOT/'tools'/'RUN_R16_FIX6_TGUSEMD_CPU.mjs',out,x])",b)
  self.assertIn("'iocs_gate':'REAL_MUSASHI_WASM_PANIC_TGUSEMD_PASS'",b)
  a=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn("info.get('iocs_gate')!='REAL_MUSASHI_WASM_PANIC_TGUSEMD_PASS'",a)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',a)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',(R/'RUN_THIS_R16_FIX17R3_ONEPASS.cmd').read_text())
 def test_iocs_trace_keeps_arguments_and_no_fake_video(self):
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  for name in ('iocsFunction','graphicsUseBefore','graphicsUseAfter','iocsTgusemdCalls','firstUnimplementedIocsFunction'):
   self.assertIn(name,t)
  self.assertIn('firstVisibleFrameIsNotDecodeProof=true',t)
