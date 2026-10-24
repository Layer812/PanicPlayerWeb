#!/usr/bin/env python3
"""Fetch pinned original Musashi, generate opcode tables and compile native WASM.

No WebX68k dependency. No Tab5 production tree is accessed. Fails closed if
commit pin / toolchain / generated opcode tables cannot be verified.
"""
from __future__ import annotations
import argparse
import os
import shutil
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'vendor'/'musashi'
PIN='313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd'
REPO='https://github.com/kstenerud/Musashi.git'
EXPORTED=[
    'pwp_mu_stage_ptr','pwp_mu_stage_capacity','pwp_mu_reset','pwp_mu_load',
    'pwp_mu_run','pwp_mu_dispatch','pwp_mu_register','pwp_mu_pc',
    'pwp_mu_steps','pwp_mu_status','pwp_mu_trap','pwp_mu_trap_pc',
    'pwp_mu_fault_address','pwp_mu_image_end','pwp_mu_bss_end',
    'pwp_mu_guest_peek32',
    'pwp_mu_set_pan_size','pwp_mu_io_stage_ptr','pwp_mu_io_capacity',
    'pwp_mu_io_offset_high','pwp_mu_io_offset_low','pwp_mu_io_length',
    'pwp_mu_supply_read',
    'pwp_mu_console_length','pwp_mu_console_byte',
    'pwp_mu_console_truncated','pwp_mu_exit_code',
    'pwp_mu_video_text_index','pwp_mu_video_palette_word','pwp_mu_video_write_count','pwp_mu_video_graphic_word',
]

def exe(program):
    e=shutil.which(program)
    if not e: raise RuntimeError(f'Missing executable: {program}')
    return e

def run(args,cwd=None):
    print('+', ' '.join(map(str,args)), flush=True)
    subprocess.run(list(map(str,args)), cwd=cwd,check=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--offline',action='store_true',help='Use previously pinned and verified local Musashi source only')
    options=parser.parse_args()
    git=exe('git')
    if not SRC.exists():
        if options.offline: raise RuntimeError('Musashi source is not cached. Cannot build offline.')
        SRC.parent.mkdir(parents=True,exist_ok=True)
        run([git,'clone','--no-checkout',REPO,SRC])
        run([git,'checkout','--detach',PIN],cwd=SRC)
    actual=subprocess.check_output([git,'rev-parse','HEAD'],cwd=SRC,text=True).strip()
    if actual != PIN: raise RuntimeError(f'Unpinned Musashi source: {actual} (expected {PIN})')
    for f in ['m68kcpu.c','m68kmake.c','m68k_in.c','softfloat/softfloat.c','m68k.h']:
        if not (SRC/f).is_file(): raise RuntimeError(f'Missing Musashi file: {f}')
    hostcc=exe(os.environ.get('PWP_HOST_CC','gcc'))
    generator=SRC/('pwp_m68kmake.exe' if os.name=='nt' else 'pwp_m68kmake')
    run([hostcc,'-O2',SRC/'m68kmake.c','-o',generator])
    run([generator],cwd=SRC)
    if not (SRC/'m68kops.c').stat().st_size or not (SRC/'m68kops.h').stat().st_size:
        raise RuntimeError('Musashi opcode generation failed')
    emcc=exe(os.environ.get('EMCC','emcc'))
    dest=ROOT/'core'/'pwp_musashi.mjs'
    compiler_options=[
        emcc,'-O2','-std=gnu11','-I',SRC,
        '-DM68K_EMULATE_010=0','-DM68K_EMULATE_EC020=0',
        '-DM68K_EMULATE_020=0','-DM68K_EMULATE_030=0',
        '-DM68K_EMULATE_040=0',
        '-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,worker,node',
        '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=16777216',
        '-sMAXIMUM_MEMORY=67108864','-sFILESYSTEM=0',
        '-sEXPORTED_FUNCTIONS='+"["+','.join("'_%s'"%x for x in EXPORTED)+"]",
        '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]',
        '--no-entry',
        ROOT/'core'/'pwp_musashi.c',ROOT/'core'/'pwp_x68k_video_bus.c',SRC/'m68kcpu.c',SRC/'m68kops.c',
        SRC/'softfloat'/'softfloat.c', '-lm', '-o',dest,
    ]
    run(compiler_options)
    wasm=dest.with_suffix('.wasm')
    if not dest.is_file() or not wasm.is_file(): raise RuntimeError('Expected Musashi WASM artifacts not created')
    print('Musashi WASM build complete (R6 DOS bridge + vector/exit/diagnostics):',wasm,'(no PAN playback claim)')

if __name__=='__main__':
    main()
