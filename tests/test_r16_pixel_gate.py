"""C runtime bus pixel counter: mock CPU regs only, no real Musashi claim."""
from pathlib import Path
import subprocess
import tempfile
import unittest
R=Path(__file__).resolve().parents[1]
class R16PixelBus(unittest.TestCase):
    def test_c_pixel_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-I',str(R/'tests/mock'),str(R/'core/pwp_musashi.c'),
                 str(R/'core/pwp_x68k_video_bus.c'),str(R/'tests/mock/mock_m68k.c'),
                 str(R/'tests/mock/test_r16_pixel_gate.c'),'-o',str(Path(tmp)/'r16')]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            p=subprocess.run([str(Path(tmp)/'r16')],check=True,capture_output=True,text=True)
            self.assertIn('PASS R16',p.stdout)
    def test_wasm_export(self):
        self.assertIn("'pwp_mu_video_pixel_writes'", (R/'tools/BUILD_R9_MUSASHI.py').read_text())
if __name__=='__main__':unittest.main()
