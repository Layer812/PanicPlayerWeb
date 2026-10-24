"""R16 FIX5 narrow authentic MFP control register values; not CPU proof."""
from pathlib import Path
import subprocess,tempfile,unittest
R=Path(__file__).resolve().parents[1]
class MFPControl(unittest.TestCase):
 def test_live_c_registers_native_ubsan(self):
  with tempfile.TemporaryDirectory() as d:
   exe=Path(d)/'mfp_test'
   cmd=['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all',
        '-I',str(R/'core'),str(R/'core/pwp_x68k_video_bus.c'),str(R/'tests/mock/test_r16_fix5_mfp.c'),'-o',str(exe)]
   subprocess.run(cmd,check=True,capture_output=True,text=True)
   res=subprocess.run([str(exe)],check=True,capture_output=True,text=True)
   self.assertIn('PASS R16 FIX5',res.stdout)
 def test_exact_production_init_reg_values_and_read_only_gate(self):
  code=(R/'core/pwp_x68k_video_bus.c').read_text()
  self.assertIn('mfp_ierb=0x3eu; mfp_imrb=0x3eu;',code)
  self.assertIn('0x00e88009u',code)
  self.assertIn('0x00e88015u',code)
  self.assertNotIn('mfp_ierb=0x40u',code)
  self.assertIn('REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS',(R/'tools/RUN_R16_FIX5_MFP_CPU.mjs').read_text())
  builder=(R/'tools/BUILD_R12_ACTUAL.py').read_text()
  self.assertIn("invoke([node,ROOT/'tools'/'RUN_R16_FIX5_MFP_CPU.mjs',out,x])",builder)
  self.assertIn("'mfp_gate':'REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS'",builder)
  runner=(R/'tools/RUN_R16_ONEPASS.py').read_text()
  self.assertIn("or info.get('mfp_gate')!='REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS'",runner)
 def test_failed_bus_address_report_and_no_claim(self):
  trace=(R/'tools/RUN_R16_PANIC_DEEP.mjs').read_text()
  for k in ('_pwp_mu_fault_address','faultAddress','mfpIERBReads','mfpIMRBReads','lastMFPReadAddress'):
   self.assertIn(k,trace)
  for k in ('actual_pan_frame_verified','real_pan_stop_reason','real_pan_fault_address'):
   self.assertIn(k,(R/'tools/RUN_R16_ONEPASS.py').read_text())
 def test_mfp_not_video_or_faked_full_device(self):
  code=(R/'core/pwp_x68k_video_bus.c').read_text()
  self.assertIn('MFP clocks, USART, IRQs and other MC68901 registers are NOT modeled',code)
  self.assertIn('if(addr==MFP_IERB_ADDRESS){',code)
  self.assertIn('mfp_ierb=value;',code)
  self.assertIn('mfp_iprb &=',code)
  self.assertIn('if(addr==MFP_IMRB_ADDRESS){mfp_imrb=value;return 1;}',code)
if __name__=='__main__':unittest.main()
