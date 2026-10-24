"""Native C bus semantics only. Does not claim 68000 instruction execution."""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class R9Bus(unittest.TestCase):
    def test_native_bus_ubsan(self):
        with tempfile.TemporaryDirectory() as d:
            binary=Path(d)/'r9_bus'
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-I',str(ROOT/'tests/mock'),
                 str(ROOT/'core/pwp_musashi.c'),
                 str(ROOT/'core/pwp_x68k_video_bus.c'),
                 str(ROOT/'tests/mock/mock_m68k.c'),
                 str(ROOT/'tests/mock/test_r9_bus.c'),'-o',str(binary)]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            p=subprocess.run([str(binary)],check=True,capture_output=True,text=True)
            self.assertIn('PASS R9 real C bus',p.stdout)
if __name__=='__main__':unittest.main()
