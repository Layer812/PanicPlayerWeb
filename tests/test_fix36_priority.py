from pathlib import Path
import subprocess,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
class VideoPriority(unittest.TestCase):
 def test_real_bus_and_native_compositor(self):
  with tempfile.TemporaryDirectory() as tmp:
   cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all','-I',str(ROOT/'core'),str(ROOT/'core/pwp_x68k_video_bus.c'),str(ROOT/'core/pwp_x68k_frame.c'),str(ROOT/'tests/mock/test_fix36_priority.c'),'-o',tmp+'/check']
   subprocess.run(cmd,check=True,capture_output=True)
   p=subprocess.run([tmp+'/check'],capture_output=True,text=True)
   self.assertEqual(p.returncode,0,p.stderr)
   self.assertIn('PASS FIX36',p.stdout)

 def test_graphics_only_identical_to_fix35(self):
  baseline=Path('/mnt/data/PanicPlayerWeb_R16_FIX35_SPRITE_ON_GATE')
  if not (baseline/'core/pwp_x68k_video_bus.c').is_file() or not (baseline/'core/pwp_x68k_frame.c').is_file():
   self.skipTest('FIX35 baseline C source not present; standalone package has no historical source dependency')
  with tempfile.TemporaryDirectory() as tmp:
   hashes=[]
   for n,root in enumerate([baseline,ROOT]):
    cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror','-I',str(root/'core'),str(root/'core/pwp_x68k_video_bus.c'),str(root/'core/pwp_x68k_frame.c'),str(ROOT/'tests/mock/test_fix36_graphics_regression.c'),'-o',tmp+'/c'+str(n)]
    subprocess.run(cmd,check=True,capture_output=True)
    hashes.append(subprocess.check_output([tmp+'/c'+str(n)],text=True).strip())
   self.assertEqual(hashes[0],hashes[1])
