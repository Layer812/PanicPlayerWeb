from pathlib import Path
import subprocess,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
class SpriteOnGate(unittest.TestCase):
 def test_native_iocs_sprite_gates_and_guest_pixels(self):
  with tempfile.TemporaryDirectory() as tmp:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all','-I',str(ROOT/'core'),str(ROOT/'core/pwp_x68k_video_bus.c'),str(ROOT/'core/pwp_x68k_frame.c'),str(ROOT/'tests/mock/test_fix35_sprite_on.c'),'-o',tmp+'/check']
   subprocess.run(cmd,check=True,capture_output=True)
   p=subprocess.run([tmp+'/check'],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stderr)
   self.assertIn('PASS FIX35',p.stdout)
