"""Checks the genuine R6 DOS C implementation with synthetic CPU registers.
A PASS here does NOT imply Musashi opcode execution. """
import pathlib, subprocess, tempfile, unittest
R=pathlib.Path(__file__).resolve().parents[1]
class R6DosTest(unittest.TestCase):
    def test_native_adapter(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=pathlib.Path(tmp)/'r6dos'
            subprocess.run(['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                '-fsanitize=undefined','-fno-sanitize-recover=all','-DPWP_TEST_STAGE',
                '-I',str(R/'tests/mock'),str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),
                str(R/'tests/mock/mock_m68k.c'),str(R/'tests/mock/test_r6_dos.c'),
                '-o',str(out)],check=True)
            proc=subprocess.run([str(out)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            self.assertIn('PASS R6 mock adapter',proc.stdout)
    def test_real_export_list(self):
        src=(R/'tools/BUILD_R5_MUSASHI.py').read_text()
        for name in ('pwp_mu_exit_code','pwp_mu_console_length','pwp_mu_console_byte','pwp_mu_console_truncated'):
            self.assertIn(name,src)
if __name__=='__main__':unittest.main()
