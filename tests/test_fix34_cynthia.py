from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class CynthiaCompositor(unittest.TestCase):
 def test_native_compositing(self):
  with tempfile.TemporaryDirectory() as tmp:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all',
       '-I',str(R/'core'),str(R/'core/pwp_x68k_video_bus.c'),str(R/'core/pwp_x68k_frame.c'),
       str(R/'tests/mock/test_fix34_cynthia.c'),'-o',tmp+'/check']
   subprocess.run(cmd,check=True,capture_output=True)
   p=subprocess.run([tmp+'/check'],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stderr)
   self.assertIn('PASS FIX34 CYNTHIA',p.stdout)
