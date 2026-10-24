"""R11 never treats missing authentic inputs as an accepted CPU build."""
from pathlib import Path
import subprocess
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
class BuildGate(unittest.TestCase):
    def test_authentic_panic_x_is_mandatory(self):
        if (ROOT/'core'/'PANIC.X').exists():self.skipTest('Authentic PANIC.X staged; destructive gate test not applicable')
        r=subprocess.run([sys.executable,str(ROOT/'tools'/'BUILD_R11_ACTUAL.py'),'--offline'],
                         capture_output=True,text=True,cwd=ROOT)
        self.assertNotEqual(r.returncode,0)
        self.assertIn('SAFE STOP',r.stdout+r.stderr)
        self.assertFalse((ROOT/'core'/'pwp_musashi.mjs').exists())
if __name__=='__main__':unittest.main()
