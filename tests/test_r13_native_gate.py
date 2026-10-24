"""R13 native smoke infrastructure (mock MUST fail genuine CPU acceptance)."""
import ctypes
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'tools'
sys.path.insert(0,str(TOOLS))
from RUN_R13_NATIVE_CPU import synthetic_hu,open_lib,stage,run

class NativeR13Tests(unittest.TestCase):
    def test_synthetic_hu_has_68000_instructions_and_hu_sizes(self):
        hu=synthetic_hu()
        self.assertEqual(hu[:2],b'HU')
        self.assertEqual(int.from_bytes(hu[12:16],'big'),len(hu)-64)
        self.assertEqual(hu[64:],bytes.fromhex('70 2a 52 80 4e 71 ff 48 ff 4c'))

    def test_64bit_native_ptr_and_mock_rejected(self):
        cc=shutil.which('gcc') or shutil.which('clang')
        if not cc:
            self.skipTest('no C host compiler')
        with tempfile.TemporaryDirectory() as tmp:
            lib=Path(tmp)/('probe.dll' if os.name=='nt' else 'probe.so')
            cmd=[cc,'-DPWP_TEST_STAGE','-O1','-std=gnu11','-I',ROOT/'tests'/'mock',
                '-I',ROOT/'core','-fPIC','-shared',ROOT/'core'/'pwp_musashi.c',
                ROOT/'core'/'pwp_x68k_video_bus.c',ROOT/'core'/'pwp_x68k_frame.c',
                ROOT/'tests'/'mock'/'mock_m68k.c','-o',lib]
            if os.name=='nt': cmd.remove('-fPIC')
            subprocess.run(list(map(str,cmd)),check=True,capture_output=True,text=True)
            m=open_lib(lib)
            ptr=stage(m,synthetic_hu())
            self.assertEqual(ctypes.string_at(ptr,2),b'HU')
            # A real CPU must compute D0=43. Mock m68k_execute never does.
            with self.assertRaisesRegex(RuntimeError,'REAL CPU TEST FAIL'):
                run(m,b'HU')

    def test_builder_does_not_claim_real_cpu_without_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd=[sys.executable,str(TOOLS/'BUILD_R13_HOST_CPU.py'),
                 '--tab5-musashi-source',tmp]
            proc=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(proc.returncode,0)
            self.assertIn('SAFE STOP R13',proc.stderr)
            self.assertFalse((ROOT/'R13_REAL_HOST_CPU_EVIDENCE.json').exists())

if __name__=='__main__':unittest.main()
