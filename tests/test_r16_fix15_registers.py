from pathlib import Path
import re,unittest
R=Path(__file__).resolve().parents[1]
class CRTCProvenance(unittest.TestCase):
 def test_hardware_registers_are_exposed_without_cpu_override(self):
  bus=(R/'core/pwp_x68k_video_bus.c').read_text()
  host=(R/'core/pwp_musashi.c').read_text()
  self.assertIn('pwp_bus_crtc_changed_writes',bus)
  self.assertIn('pwp_mu_video_crtc_reg(uint32_t index)',host)
  self.assertIn('pwp_mu_video_vctrl_r2',host)
 def test_actual_trace_records_live_scroll(self):
  s=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  for name in ('videoRegisterTransitions','changedCRTCWrites','viewportNewImageAfter300K','g0ScrollChanged','PWP_VIEWPORT_NEXT_CHANGE.png','MAX_SLICES=4800'):
   self.assertIn(name,s)
  self.assertNotIn('mock',s.lower())
 def test_single_report_and_readonly_source(self):
  a=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  c=(R/'RUN_THIS_R16_FIX17R3_ONEPASS.cmd').read_text()
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',a)
  self.assertIn('PWP_R16_FIX17R3_SEND_THIS.zip',c)
  self.assertIn('production_original_unchanged',a)
 def test_change_png_requires_hash(self):
  a=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn('New viewport change PNG integrity failure',a)

class CRTCNativeOracle(unittest.TestCase):
 def test_compiled_bus_reports_actual_register_mutations(self):
  import ctypes, shutil, subprocess, tempfile,sys
  gcc=shutil.which('gcc')
  if not gcc:self.skipTest('Host GCC unavailable; Windows real Musashi build is the acceptance gate')
  with tempfile.TemporaryDirectory(prefix='pwp_fix15_oracle_') as d:
   suffix='.dll' if sys.platform.startswith('win') else '.so'
   binary=Path(d)/('pwp_bus'+suffix)
   subprocess.run([gcc,'-std=gnu11','-shared','-fPIC',str(R/'core/pwp_x68k_video_bus.c'),'-o',str(binary)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   so=ctypes.CDLL(str(binary))
   so.pwp_bus_reset()
   so.pwp_bus_write8.argtypes=[ctypes.c_uint32,ctypes.c_uint8]
   so.pwp_bus_crtc_register.argtypes=[ctypes.c_uint32]
   self.assertEqual(so.pwp_bus_crtc_changed_writes(),0)
   self.assertEqual(so.pwp_bus_write8(0xe80019,44),1)
   self.assertEqual(so.pwp_bus_write8(0xe8001b,24),1)
   self.assertEqual(so.pwp_bus_crtc_changed_writes(),2)
   self.assertEqual(so.pwp_bus_crtc_register(0x19),44)
   self.assertEqual(so.pwp_bus_crtc_register(0x1b),24)
   self.assertEqual(so.pwp_bus_write8(0xe80019,44),1) # unchanged value
   self.assertEqual(so.pwp_bus_crtc_changed_writes(),2)
   self.assertEqual(so.pwp_bus_write8(0xe82601,0x41),1)
   self.assertEqual(so.pwp_bus_vctrl_r2(),0x41)
   so.pwp_bus_reset()
   self.assertEqual(so.pwp_bus_crtc_changed_writes(),0)
   self.assertEqual(so.pwp_bus_crtc_register(0x19),0)
   self.assertEqual(so.pwp_bus_vctrl_r2(),0)
