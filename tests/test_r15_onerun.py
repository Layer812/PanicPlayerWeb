"""No fake CPU PASS: failure still produces precisely one report artifact."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
ROOT=Path(__file__).resolve().parents[1]
class R15OneRun(unittest.TestCase):
 def test_missing_source_still_produces_one_fail_report(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p=subprocess.run([sys.executable,str(ROOT/'tools/RUN_R15_ONECMD.py'),
     '--x68ktab-root',str(root/'nonexistent'),'--report-dir',str(root)],capture_output=True,text=True)
   self.assertNotEqual(p.returncode,0)
   z=root/'PWP_R15_SEND_THIS.zip'
   self.assertTrue(z.is_file())
   with zipfile.ZipFile(z) as f:
    self.assertEqual(set(f.namelist()),{'SUMMARY.json','native_musashi.log','wasm_musashi.log'})
    report=json.loads(f.read('SUMMARY.json'))
    self.assertEqual(report['status'],'SAFE_STOP')
    self.assertIsNone(report['real_wasm_cpu_rc'])
    self.assertFalse(report['pan_video_audio_playback_verified'])
    self.assertIn('NOT RUN',f.read('wasm_musashi.log').decode())
 def test_source_archive_does_not_bundle_mock_as_production_core(self):
  builder=(ROOT/'tools/BUILD_R13_HOST_CPU.py').read_text()
  self.assertNotIn('tests/mock/mock_m68k.c',builder)
  self.assertIn('RUN_R14_NATIVE_GUEST_IO.py',builder)
