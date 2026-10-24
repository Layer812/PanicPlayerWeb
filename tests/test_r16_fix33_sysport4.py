"""Hardware-defined X68000 system port #4, from real VIDEO BUS C."""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]


def test_system_port4_is_bounded_and_has_real_read_write_semantics():
    cc=shutil.which('gcc') or shutil.which('clang')
    assert cc, 'native C compiler required'
    program=r'''#include <stdint.h>
#include "pwp_x68k_video_bus.h"
#define PORT4 0x00e8e007u
int main(void) {
    uint8_t b=0xff;
    pwp_bus_reset();
    if(!pwp_bus_access8(PORT4) || !pwp_bus_writable8(PORT4))return 1;
    if(pwp_bus_sysport4_control()!=0)return 2;
    if(!pwp_bus_read8(PORT4,&b) || b!=0x08)return 3;
    if(!pwp_bus_write8(PORT4,0x0a))return 4;
    if(pwp_bus_sysport4_control()!=0x0a)return 5;
    if(!pwp_bus_read8(PORT4,&b) || b!=0x08)return 6;
    /* Writing zero disables KEY transmission, not physical connection. */
    if(!pwp_bus_write8(PORT4,0x00))return 7;
    if(pwp_bus_sysport4_control()!=0)return 8;
    if(!pwp_bus_read8(PORT4,&b) || b!=0x08)return 9;
    if(!pwp_bus_write8(PORT4,0xff))return 10;
    if(pwp_bus_sysport4_control()!=0x0e)return 11;
    /* Unknown neighbors are not silently treated as registers. */
    if(pwp_bus_access8(PORT4-1u) || pwp_bus_access8(PORT4+1u))return 12;
    if(pwp_bus_read8(PORT4-1u,&b)||pwp_bus_write8(PORT4+1u,0))return 13;
    if(!pwp_bus_read8(PORT4,&b) || b!=0x08)return 14;
    pwp_bus_reset();
    if(pwp_bus_sysport4_control()!=0)return 15;
    if(!pwp_bus_read8(PORT4,&b)||b!=0x08)return 16;
    return 0;
}'''
    with tempfile.TemporaryDirectory() as d:
        t=Path(d)
        (t/'test.c').write_text(program)
        out=t/'test'
        subprocess.run([cc,'-std=c11','-O2','-Wall','-Wextra','-Werror',
                        '-I',str(ROOT/'core'),str(t/'test.c'),
                        str(ROOT/'core/pwp_x68k_video_bus.c'),'-o',str(out)],
                        check=True,capture_output=True,text=True)
        subprocess.run([str(out)],check=True,capture_output=True,text=True)
