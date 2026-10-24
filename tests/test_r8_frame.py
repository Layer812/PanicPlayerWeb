"""Real C VRAM palette raster compilation; not an emulated PANIC playback."""
import pathlib, subprocess, tempfile, unittest
R=pathlib.Path(__file__).resolve().parents[1]
class Frame(unittest.TestCase):
    def test_real_frame_native_ubsan(self):
        with tempfile.TemporaryDirectory() as td:
            exe=pathlib.Path(td)/'r8_frame'
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-I',str(R/'core'),str(R/'core/pwp_x68k_video_bus.c'),
                 str(R/'core/pwp_x68k_frame.c'),str(R/'tests/mock/test_r8_frame.c'),'-o',str(exe)]
            subprocess.run(cmd,check=True)
            v=subprocess.run([str(exe)],capture_output=True,text=True,check=True)
            self.assertIn('PASS R8 real C frame renderer',v.stdout)
    def test_real_wasm_compilation(self):
        subprocess.run(['python3',str(R/'tools/BUILD_R8_VIDEO_WASM.py')],check=True,
                       stdout=subprocess.DEVNULL)
        self.assertTrue((R/'core/pwp_x68k_video_frame.wasm').stat().st_size>1000)
if __name__=='__main__':unittest.main()
