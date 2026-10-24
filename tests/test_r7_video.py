"""Exercises real R7 video bus C; CPU register engine still test-only mock."""
import pathlib
import subprocess
import tempfile
import unittest
R=pathlib.Path(__file__).resolve().parents[1]
class Video(unittest.TestCase):
    def test_real_video_bus_against_mock_cpu(self):
        with tempfile.TemporaryDirectory() as temp:
            exe=pathlib.Path(temp)/'r7bus'
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                '-fsanitize=undefined','-fno-sanitize-recover=all',
                '-I',str(R/'tests/mock'),str(R/'core/pwp_musashi.c'),
                str(R/'core/pwp_x68k_video_bus.c'),
                str(R/'tests/mock/mock_m68k.c'),str(R/'tests/mock/test_r7_video.c'),
                '-o',str(exe)]
            subprocess.run(cmd,check=True)
            r=subprocess.run([str(exe)],text=True,capture_output=True,check=True)
            self.assertIn('PASS R7 guest video bus',r.stdout)
if __name__=='__main__':unittest.main()
