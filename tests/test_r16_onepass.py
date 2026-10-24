"""R16 runner never reports a real CPU PASS when input sources are absent."""
from pathlib import Path
import json,subprocess,sys, tempfile,unittest,zipfile
R=Path(__file__).resolve().parents[1]
class RunnerR16(unittest.TestCase):
 def test_missing_original_source_makes_one_zip_but_no_pass(self):
  with tempfile.TemporaryDirectory() as t:
   report=Path(t)/'reports';report.mkdir()
   p=subprocess.run([sys.executable,R/'tools/RUN_R16_ONEPASS.py',
     '--source',str(Path(t)/'no-x68k'),'--report-dir',str(report)],
     capture_output=True,text=True,timeout=35)
   self.assertEqual(p.returncode,2,p.stderr)
   files=list(report.glob('*.zip'))
   self.assertEqual(len(files),1)
   with zipfile.ZipFile(files[0]) as z:
    self.assertIsNone(z.testzip())
    s=json.loads(z.read('SUMMARY.json'))
    self.assertEqual(s['status'],'SAFE_STOP')
    self.assertIsNone(s['wasm_rc'])
    self.assertFalse(s['actual_pan_frame_verified'])
    self.assertTrue(s['production_original_unchanged'])
 def test_compile_gate_calls_real_deep_probe_and_cpu_tests(self):
  t=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn('RUN_R9_CPU_SMOKE.mjs',t)
  self.assertIn('RUN_R9_PANIC_BOOT.mjs',t)
  self.assertIn('RUN_R14_WASM_GUEST_IO.mjs',t)
  self.assertIn('RUN_R16_PANIC_DEEP.mjs',t)
  self.assertNotIn('mock_m68k.c',t)
 def test_boot_probe_fails_closed_on_unverified_binary(self):
  t=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  self.assertIn('PANIC.X V1.38 (SHA-256 mismatch)',t)
  self.assertIn('firstVisibleFrame:false',t)
  self.assertIn('pastInitialSetblock',t)
if __name__=='__main__':unittest.main()
