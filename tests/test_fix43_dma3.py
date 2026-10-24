# Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
"""FIX43 native bus-master DMA timing and MSM6258 FIFO regression."""
from pathlib import Path
import subprocess, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
class DMA3ActualTest(unittest.TestCase):
    def test_transfer(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd=['gcc','-O2','-std=c11','-Wall','-Wextra','-Werror',
                 '-fsanitize=undefined','-fno-sanitize-recover=all',
                 '-I',str(ROOT/'core'),str(ROOT/'core/pwp_x68k_video_bus.c'),
                 str(ROOT/'tests/mock/test_fix43_dma3.c'),'-o',tmp+'/test']
            subprocess.run(cmd,check=True,capture_output=True)
            p=subprocess.run([tmp+'/test'],text=True,capture_output=True)
            self.assertEqual(p.returncode,0,p.stderr)
            self.assertIn('PASS FIX43',p.stdout)
