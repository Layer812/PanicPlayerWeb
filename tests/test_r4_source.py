import ast
import pathlib
import re
import subprocess
import tempfile
import unittest
R=pathlib.Path(__file__).resolve().parents[1]

class Source(unittest.TestCase):
    def test_pin_and_build_require_real_musashi(self):
        source=(R/'tools/BUILD_R5_MUSASHI.py').read_text()
        self.assertIn('313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd',source)
        self.assertIn('m68kmake.c',source)
        self.assertIn('m68kcpu.c',source)
        self.assertIn('m68kops.c',source)
        ast.parse(source)
    def test_never_claim_browser_playback(self):
        self.assertIn('playable:false',(R/'src/musashi-probe.mjs').read_text())
        self.assertIn('Unimplemented F-line or IOCS must remain blocked.', (R/'core/pwp_musashi.c').read_text())
    def test_native_mock_abi_compiles_and_runs(self):
        with tempfile.TemporaryDirectory() as work:
            out=pathlib.Path(work)/'adapter'
            src=R/'tests/mock'
            subprocess.run(['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror','-DPWP_TEST_STAGE','-I',str(src),
                str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),str(src/'mock_m68k.c'),str(src/'test_adapter.c'),'-o',str(out)],check=True)
            p=subprocess.run([out],check=True,capture_output=True,text=True)
            self.assertIn('PASS R4',p.stdout)
    def test_no_hidden_musashi_in_build_package(self):
        self.assertFalse((R/'core/pwp_musashi.wasm').exists())

if __name__=='__main__':unittest.main()
