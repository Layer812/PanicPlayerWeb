"""Native C correctness tests with a mock CPU: NOT a real Musashi gate."""
from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class TestNameckFiles(unittest.TestCase):
 def test_native_c_bounds_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   exe=Path(d)/'nameck_files'
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror',
        '-fsanitize=undefined','-fno-sanitize-recover=all',
        '-I',str(R/'tests/mock'),'-I',str(R/'core'),'-DPWP_TEST_STAGE',
        str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
        str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/mock_m68k_super.c'),
        str(R/'tests/mock/test_r16_fix8_nameck_files.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,text=True,capture_output=True)
   result=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
   self.assertIn('PASS R16 FIX8',result.stdout)
 def test_real_cpu_gate_required(self):
  b=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn('RUN_R16_FIX8_NAMECK_CPU.mjs',b)
  self.assertIn('REAL_MUSASHI_WASM_PANIC_NAMECK_PASS',b)
  o=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn("info.get('nameck_gate')",o)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',o)
 def test_abi_trace_captures_buffer_and_return(self):
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  self.assertIn('nameckInput',t)
  self.assertIn('nameckOutput',t)
  self.assertIn('filesPath',t)
  self.assertIn('filesReportedSize',t)
if __name__=='__main__':unittest.main()
