#!/usr/bin/env python3
"""Build real VIDEO RAM+partial raster WASM; no fabricated Musashi/PAN runtime."""
from pathlib import Path
import shutil
import subprocess
ROOT=Path(__file__).resolve().parents[1]
clang=shutil.which('clang')
if not clang: raise SystemExit('STOP: clang wasm32 target is required')
exports=['pwp_bus_reset','pwp_bus_apply_crtmod10','pwp_bus_g_clr_on10','pwp_bus_read8','pwp_bus_write8','pwp_bus_text_index',
         'pwp_bus_palette_word','pwp_bus_video_writes','pwp_bus_graphic_word',
         'pwp_frame_render','pwp_frame_render_mode10','pwp_frame_pointer','pwp_frame_size','pwp_frame_grb8888','pwp_frame_set_palette0_evidence','pwp_frame_gfx_nonzero','pwp_frame_text_nonzero','pwp_frame_gfx_text_overlap','pwp_frame_gfx_palette_zero','pwp_frame_gfx_visible_pixels','pwp_frame_text_visible_pixels']
cmd=[clang,'--target=wasm32','-O2','-std=c11','-nostdlib','-fno-builtin',
     '-Wall','-Wextra','-Werror','-Wl,--no-entry','-Wl,--export-memory',
     '-Wl,--initial-memory=4194304','-Wl,--max-memory=4194304',
     *['-Wl,--export='+x for x in exports],
     str(ROOT/'core/pwp_x68k_video_bus.c'),str(ROOT/'core/pwp_x68k_frame.c'),
     '-o',str(ROOT/'core/pwp_x68k_video_frame.wasm')]
subprocess.run(cmd,check=True)
print('PASS R8: real guest VRAM to RGBA WASM. NOT PAN playback or Musashi CPU.')
