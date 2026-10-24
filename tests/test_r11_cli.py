"""Native HU startup contract only. No fake guest CPU execution."""
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class HUCommandLine(unittest.TestCase):
    def test_native_lascii_and_startup_registers(self):
        with tempfile.TemporaryDirectory() as d:
            exe=Path(d)/'r11_commandline'
            subprocess.run(['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
               '-fsanitize=undefined','-fno-sanitize-recover=all','-DPWP_TEST_STAGE',
               '-I',str(ROOT/'tests/mock'),
               str(ROOT/'core/pwp_musashi.c'),str(ROOT/'core/pwp_x68k_video_bus.c'),
               str(ROOT/'tests/mock/mock_m68k.c'),str(ROOT/'tests/mock/test_r11_cli.c'),
               '-o',str(exe)],check=True,capture_output=True,text=True)
            p=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
            self.assertIn('PASS R11 native HU command-line layout',p.stdout)
if __name__=='__main__':unittest.main()
