from pathlib import Path
import shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
def test_real_bus_irq_pending_and_mask_transitions():
 cc=shutil.which('gcc') or shutil.which('clang');assert cc
 code=r'''
 #include <stdint.h>
 #include "pwp_x68k_video_bus.h"
 #define IERB 0x00e88009u
 #define IPRB 0x00e8800du
 #define ISRB 0x00e88011u
 #define IMRB 0x00e88015u
 static uint8_t reg(uint32_t a) {uint8_t v=0xff;if(!pwp_bus_read8(a,&v))return 0xff;return v;}
 int main(void){
   pwp_bus_reset();
   if(reg(IPRB)!=0 || pwp_bus_mfp_vdisp_latched())return 1;
   pwp_bus_mfp_vdisp_pulse();if(pwp_bus_mfp_vdisp_latched())return 2;
   if(!pwp_bus_write8(IERB,0x7e))return 3;
   pwp_bus_mfp_vdisp_pulse();
   if(reg(IPRB)!=0x40 || !pwp_bus_mfp_vdisp_latched())return 4;
   if(pwp_bus_mfp_vdisp_irq_ready())return 5;
   if(!pwp_bus_write8(IMRB,0x7e))return 6;
   if(!pwp_bus_mfp_vdisp_irq_ready())return 7;
   pwp_bus_mfp_vdisp_ack();
   if(reg(IPRB)!=0 || pwp_bus_mfp_vdisp_irq_ready())return 8;
   pwp_bus_mfp_vdisp_pulse();if(!pwp_bus_mfp_vdisp_irq_ready())return 9;
   if(!pwp_bus_write8(IPRB,0xbf))return 10;
   if(pwp_bus_mfp_vdisp_irq_ready())return 11;
   pwp_bus_mfp_vdisp_pulse();
   if(!pwp_bus_write8(IERB,0x3e))return 12;
   if(pwp_bus_mfp_vdisp_latched())return 13;
   if(!pwp_bus_write8(ISRB,0xbf)||reg(ISRB)!=0)return 14;
   pwp_bus_reset();
   if(reg(IPRB)||reg(IERB)!=0x3e||reg(IMRB)!=0x3e)return 15;
   return 0;
 }
 '''
 with tempfile.TemporaryDirectory() as d:
  d=Path(d);(d/'test.c').write_text(code)
  exe=d/'mfp_latch'
  subprocess.run([cc,'-std=gnu11','-O2','-Wall','-Wextra','-Werror','-fsanitize=undefined','-fno-sanitize-recover=all','-I'+str(ROOT/'core'),str(d/'test.c'),str(ROOT/'core/pwp_x68k_video_bus.c'),'-o',str(exe)],check=True,capture_output=True,text=True)
  subprocess.run([str(exe)],check=True,capture_output=True,text=True)
