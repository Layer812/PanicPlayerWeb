"""The missing real core is never replaced by a fake Musashi executable."""
import pathlib
import subprocess
import unittest
R=pathlib.Path(__file__).resolve().parents[1]
class RealCoreGate(unittest.TestCase):
    def test_offline_source_absence_stops(self):
        source=R/'vendor'/'musashi-r9-work'
        if source.exists():
            # The original R9 test assumed Musashi could never be present.
            # When R10's real builder has fetched it, the negative test is
            # no longer valid and must not make repeat builds fail.
            self.skipTest('Musashi checkout present: actual builder owns verification')
        p=subprocess.run(['python3',str(R/'tools/BUILD_R9_MUSASHI.py'),'--offline'],
                         cwd=R,capture_output=True,text=True)
        # Offline probe is only a negative test; not a pass for Musashi itself.
        self.assertNotEqual(p.returncode,0)
        self.assertIn('Musashi checkout',p.stderr)
    def test_real_cpu_smoke_is_not_a_mock(self):
        src=(R/'tools/RUN_R9_CPU_SMOKE.mjs').read_text()
        self.assertIn('MOVEQ 42; ADDQ.L 1',src)
        self.assertIn('_pwp_mu_steps()',src)
        self.assertIn("assert.equal(wasm._pwp_mu_trap()>>>0,0xff48",src)
        self.assertNotIn('mock_m68k',src)
    def test_original_panic_boot_is_separate_and_required_when_provided(self):
        builder=(R/'tools/BUILD_R9_MUSASHI.py').read_text()
        self.assertIn('RUN_R9_CPU_SMOKE.mjs',builder)
        self.assertIn('RUN_R9_PANIC_BOOT.mjs',builder)
        self.assertIn('no already-verified Musashi checkout',builder)
if __name__=='__main__':unittest.main()
