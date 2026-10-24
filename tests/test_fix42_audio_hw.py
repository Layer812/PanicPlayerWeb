# Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
"""FIX42 native hardware register and cycle accounting regression."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class AudioHardwareTest(unittest.TestCase):
    def test_ym_busy_adpcm_pia(self):
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / 'fix42_test'
            cmd = ['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror',
                   '-fsanitize=undefined','-fno-sanitize-recover=all',
                   '-I',str(ROOT/'core'),
                   str(ROOT/'tests/mock/test_fix42_audio_hw.c'),
                   '-o',str(binary)]
            subprocess.run(cmd,check=True,capture_output=True)
            out = subprocess.run([str(binary)],capture_output=True,text=True)
            self.assertEqual(out.returncode,0,out.stderr)
            self.assertIn('PASS FIX42',out.stdout)
