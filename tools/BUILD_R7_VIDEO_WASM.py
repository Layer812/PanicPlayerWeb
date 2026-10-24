#!/usr/bin/env python3
"""Rebuild real C text-VRAM/CRTC/palette subset for browser WASM without emcc.
Not a Musashi or PAN playback build.
"""
from pathlib import Path
import shutil
import subprocess
R=Path(__file__).resolve().parents[1]
clang=shutil.which('clang')
if not clang: raise SystemExit('clang is required (with wasm32 target)')
cmd=[clang,'--target=wasm32','-O2','-std=c11','-nostdlib','-fno-builtin',
 '-Wl,--no-entry','-Wl,--export-memory','-Wl,--initial-memory=2097152',
 '-Wl,--max-memory=2097152',
 *['-Wl,--export='+v for v in (
   'pwp_bus_reset','pwp_bus_read8','pwp_bus_write8','pwp_bus_text_index',
   'pwp_bus_palette_word','pwp_bus_video_writes','pwp_bus_graphic_word')],
 str(R/'core/pwp_x68k_video_bus.c'),'-o',str(R/'core/pwp_x68k_video_bus.wasm')]
subprocess.run(cmd,check=True)
print('PASS: standalone VIDEO RAM WASM created. Not a PANIC CPU/player build.')
