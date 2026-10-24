"""Real native VIDEO BUS test, no fake frame or CPU claim."""
from pathlib import Path
import subprocess, shutil, tempfile
ROOT=Path(__file__).resolve().parents[1]

def test_gpip4_display_blank_and_interrupt_register_gates():
    cc=shutil.which('gcc') or shutil.which('clang')
    assert cc, 'native compiler is required for bus acceptance'
    harness=r'''
    #include <stdint.h>
    #include "pwp_x68k_video_bus.h"
    #define GPIP 0xE88001u
    #define IERB 0xE88009u
    #define IMRB 0xE88015u
    int main(void){
      uint8_t b=0;
      pwp_bus_reset();
      if(!pwp_bus_access8(GPIP)||pwp_bus_writable8(GPIP))return 1;
      if(!pwp_bus_read8(GPIP,&b)||(b&0x10u)!=0x10u)return 2;
      if(pwp_bus_mfp_gpip4_reads()!=1u)return 3;
      if(pwp_bus_write8(GPIP,0))return 4;
      pwp_bus_mfp_set_vdisp_active(0);
      if(!pwp_bus_read8(GPIP,&b)||(b&0x10u))return 5;
      if(pwp_bus_mfp_gpip4_level()!=0u)return 6;
      pwp_bus_mfp_set_vdisp_active(1);
      if(!pwp_bus_read8(GPIP,&b)||(b&0x10u)!=0x10u)return 7;
      if(pwp_bus_mfp_gpip4_reads()!=3u)return 8;
      if(pwp_bus_mfp_vdisp_enabled())return 9;
      if(!pwp_bus_write8(IERB,0x7e)||!pwp_bus_write8(IMRB,0x7e))return 10;
      if(!pwp_bus_mfp_vdisp_enabled())return 11;
      pwp_bus_reset();
      if(pwp_bus_mfp_gpip4_reads() || !pwp_bus_mfp_gpip4_level())return 12;
      if(pwp_bus_mfp_vdisp_enabled())return 13;
      return 0;
    }
    '''
    with tempfile.TemporaryDirectory() as d:
        d=Path(d); (d/'gpip.c').write_text(harness)
        out=d/'gpip_probe'
        subprocess.run([cc,'-std=gnu11','-Wall','-Wextra','-Werror','-I',str(ROOT/'core'),str(d/'gpip.c'),str(ROOT/'core/pwp_x68k_video_bus.c'),'-o',str(out)],check=True,capture_output=True,text=True)
        subprocess.run([str(out)],check=True,capture_output=True,text=True)
