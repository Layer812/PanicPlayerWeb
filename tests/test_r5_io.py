import pathlib, subprocess, tempfile, unittest
R=pathlib.Path(__file__).resolve().parents[1]
class IOTest(unittest.TestCase):
    def test_real_c_adapter_against_test_double(self):
        with tempfile.TemporaryDirectory() as work:
            out=pathlib.Path(work)/'r5io'
            src=R/'tests/mock'
            subprocess.run(['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror','-DPWP_TEST_STAGE',
                '-I',str(src),str(R/'core/pwp_musashi.c'),str(R/'core/pwp_x68k_video_bus.c'),str(src/'mock_m68k.c'),
                str(src/'test_r5_io.c'),'-o',str(out)],check=True)
            got=subprocess.run([str(out)],capture_output=True,text=True,check=True)
            self.assertIn('27 synthetic trap cases',got.stdout)
    def test_exports_are_declared(self):
        contents=(R/'tools/BUILD_R5_MUSASHI.py').read_text()
        for symbol in ('pwp_mu_set_pan_size','pwp_mu_supply_read','pwp_mu_io_length','pwp_mu_io_stage_ptr'):
            self.assertIn(symbol,contents)
    def test_no_fake_cpu_or_playable_claim(self):
        self.assertFalse((R/'core/pwp_musashi.wasm').exists())
        self.assertIn('playable:false',(R/'src/musashi-r5-probe.mjs').read_text())
if __name__=='__main__': unittest.main()
