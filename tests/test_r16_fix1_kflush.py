import unittest,subprocess,tempfile,pathlib,shutil
R=pathlib.Path(__file__).resolve().parents[1]
class Kflush(unittest.TestCase):
 def test_native_mock_keyboard_dispatch(self):
  if not shutil.which('gcc'):self.skipTest('native GCC unavailable')
  with tempfile.TemporaryDirectory() as td:
   exe=pathlib.Path(td)/'test'
   cmd=['gcc','-std=c11','-Wall','-Wextra','-Werror','-O2','-fsanitize=undefined','-fno-sanitize-recover=all',
       '-DPWP_TEST_STAGE','-I',str(R/'tests/mock'),str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
       str(R/'tests/mock/mock_m68k.c'),str(R/'tests/mock/test_r16_fix1_kflush.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,capture_output=True)
   res=subprocess.run([str(exe)],check=True,text=True,capture_output=True)
   self.assertIn('PASS R16 FIX1 KFLUSH',res.stdout)
 def test_trace_reports_real_input_separately(self):
  s=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  self.assertIn('visibleAfterRealPanRead',s)
  self.assertIn('guestExitCode',s)
  self.assertIn('kflushMode',s)
 def test_real_pan_is_opt_in_read_only(self):
  s=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn("ap.add_argument('--pan'",s)
  self.assertIn("'--pan',pan",s)
  self.assertIn("PWP_R16_FIX17R3_SEND_THIS.zip",s)
