"""Native timing regression only. Not a real PAN replay result."""
from pathlib import Path
import shutil, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[1]

def test_vblank_handler_window_precedes_guest_visible_scanout():
    cc=shutil.which('gcc') or shutil.which('clang')
    assert cc
    code=r"""
    #include <stdint.h>
    #include "pwp_x68k_video_bus.h"
    void pwp_mu_reset(void);
    void pwp_mu_test_advance_cycles(uint32_t);
    uint32_t pwp_mu_vdisp_ticks(void);
    uint32_t pwp_mu_scanout_ticks(void);
    uint32_t pwp_mu_vdisp_acks(void);
    #define CYCLE_PER_FRAME 266667u
    #define ACTIVE_CYCLES (CYCLE_PER_FRAME*9u/10u)
    int main(void){
      pwp_mu_reset();
      if (pwp_mu_vdisp_ticks() || pwp_mu_scanout_ticks()) return 1;
      if (!pwp_bus_mfp_gpip4_level()) return 2;
      pwp_mu_test_advance_cycles(ACTIVE_CYCLES-1u);
      if (pwp_mu_vdisp_ticks() || pwp_mu_scanout_ticks()) return 3;
      pwp_mu_test_advance_cycles(1u);  /* VBlank falling edge */
      if (pwp_mu_vdisp_ticks()!=1 || pwp_mu_scanout_ticks()!=0) return 4;
      if (pwp_bus_mfp_gpip4_level()) return 5;
      pwp_mu_test_advance_cycles(CYCLE_PER_FRAME-ACTIVE_CYCLES-1u);
      if (pwp_mu_scanout_ticks() || pwp_bus_mfp_gpip4_level()) return 6;
      pwp_mu_test_advance_cycles(1u);  /* New visible scan starts */
      if (pwp_mu_scanout_ticks()!=1 || pwp_mu_vdisp_ticks()!=1) return 7;
      if (!pwp_bus_mfp_gpip4_level()) return 8;
      pwp_mu_test_advance_cycles(ACTIVE_CYCLES);
      if (pwp_mu_vdisp_ticks()!=2 || pwp_mu_scanout_ticks()!=1) return 9;
      pwp_mu_test_advance_cycles(CYCLE_PER_FRAME-ACTIVE_CYCLES);
      if (pwp_mu_vdisp_ticks()!=2 || pwp_mu_scanout_ticks()!=2) return 10;
      pwp_mu_reset();
      if (pwp_mu_vdisp_ticks() || pwp_mu_scanout_ticks()) return 11;
      return 0;
    }
    """
    with tempfile.TemporaryDirectory() as d:
        d=Path(d);(d/'test.c').write_text(code)
        exe=d/'scanout_probe'
        cmd=[cc,'-O2','-std=gnu11','-DPWP_TEST_STAGE','-I'+str(ROOT/'tests/mock'),'-I'+str(ROOT/'core'),
            str(d/'test.c'),str(ROOT/'core/pwp_musashi.c'),
            str(ROOT/'core/pwp_x68k_video_bus.c'),str(ROOT/'core/pwp_x68k_frame.c'),
            str(ROOT/'tests/mock/mock_m68k.c'),'-o',str(exe)]
        subprocess.run(cmd,check=True,capture_output=True,text=True)
        subprocess.run([str(exe)],check=True,capture_output=True,text=True)
