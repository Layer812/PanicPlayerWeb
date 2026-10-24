import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from EXTRACT_PANIC_X import extract, KNOWN_SIZE

class Extraction(unittest.TestCase):
    def test_exact_bytes_and_header(self):
        src = ('const uint8_t panic_x_bin[] = {' + '0x48,0x55,' + '0x00,'*(KNOWN_SIZE - 2) +
            '}; const size_t panic_x_bin_len = 15412u;')
        data = extract(src)
        self.assertEqual(len(data), KNOWN_SIZE)
        self.assertEqual(data[:2], b'HU')
    def test_reject_nonliteral(self):
        with self.assertRaisesRegex(ValueError, 'non-literal'):
            extract('const uint8_t panic_x_bin[] = {0x48,FOO,0x55}; const size_t panic_x_bin_len = 3u;')
    def test_reject_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            extract('const uint8_t panic_x_bin[] = {0x48,0x55}; const size_t panic_x_bin_len = 3u;')
    def test_reject_bad_header(self):
        src = ('const uint8_t panic_x_bin[] = {' + '0x45,0x4c,' + '0x00,'*(KNOWN_SIZE - 2) +
            '}; const size_t panic_x_bin_len = 15412u;')
        with self.assertRaisesRegex(ValueError, 'header'):
            extract(src)

if __name__ == '__main__':unittest.main()
