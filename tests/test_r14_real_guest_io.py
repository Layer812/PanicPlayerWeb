"""Real Musashi acceptance program and native pointer regression tests.

These are shape/ABI and fail-closed tests, not real 68000 CPU acceptance.
Only RUN_R14_NATIVE_GUEST_IO.py with a real Musashi shared library is that gate.
"""
import ctypes
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from RUN_R13_NATIVE_CPU import open_lib
from RUN_R14_NATIVE_GUEST_IO import synth_hu, PATH_ADDR, FIRST_READ, FILE_SIZE, attach, run


class R14RealGuestIOTests(unittest.TestCase):
    def test_program_is_a_real_hu_with_real_68000_opcodes(self):
        hu=synth_hu()
        self.assertEqual(hu[:2],b'HU')
        self.assertEqual(int.from_bytes(hu[12:16],'big'),len(hu)-64)
        code=hu[64:64+0x500]
        for trap in [bytes.fromhex(i) for i in ('ff3d','ff3f','ff42','ff3e','ff00')]:
            self.assertIn(trap,code)
        self.assertEqual(code.count(bytes.fromhex('ff3f')),2)
        self.assertEqual(hu[64+PATH_ADDR-0x10000:64+PATH_ADDR-0x10000+12],b'C:\\P68K.PAN\0')
        self.assertGreater(FIRST_READ,65536)
        self.assertLess(FIRST_READ,FILE_SIZE)

    def test_native_io_pointer_is_full_width_and_mock_cpu_cannot_pass(self):
        cc=shutil.which('gcc') or shutil.which('clang')
        if not cc:
            self.skipTest('Host C compiler missing')
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/('cpu.dll' if os.name=='nt' else 'cpu.so')
            cmd=[cc,'-DPWP_TEST_STAGE','-std=gnu11','-O1',
                 '-I'+str(ROOT/'tests/mock'),'-I'+str(ROOT/'core'),
                 '-fPIC','-shared',str(ROOT/'core/pwp_musashi.c'),
                 str(ROOT/'core/pwp_x68k_video_bus.c'),
                 str(ROOT/'core/pwp_x68k_frame.c'),
                 str(ROOT/'tests/mock/mock_m68k.c'),'-o',str(out)]
            if os.name=='nt': cmd.remove('-fPIC')
            p=subprocess.run(cmd,text=True,capture_output=True)
            self.assertEqual(p.returncode,0,p.stderr)
            lib=open_lib(out)
            attach(lib)
            self.assertEqual(lib.pwp_mu_io_stage_native_ptr(),lib.pwp_mu_stage_native_ptr())
            self.assertGreater(lib.pwp_mu_io_stage_native_ptr(),4096)
            with self.assertRaisesRegex(RuntimeError,'REAL CPU TEST FAIL'):
                run(lib)

    def test_host_builder_enforces_real_file_io_followup(self):
        source=(ROOT/'tools/BUILD_R13_HOST_CPU.py').read_text()
        self.assertIn('RUN_R14_NATIVE_GUEST_IO.py',source)
        self.assertIn('REAL_NATIVE_MUSASHI_GUEST_IO_PASS',source)
        self.assertNotIn('mock_m68k.c',source)
        wasm_builder=(ROOT/'tools/BUILD_R12_ACTUAL.py').read_text()
        self.assertIn('RUN_R14_WASM_GUEST_IO.mjs',wasm_builder)

if __name__=='__main__':unittest.main()
