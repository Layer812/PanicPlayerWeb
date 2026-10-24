#!/usr/bin/env python3
"""Build actual pinned upstream Musashi for the standalone PANIC Web R7 adapter.
No WebX68k. Does not touch any Tab5 or upstream source directory. Build is
safe-stop if original source commit/toolchain unavailable. No fake CPU fallback.
"""
import argparse
import os
import shutil
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'vendor'/'musashi-r7-work'
PIN='313ebf1bd9f4d0d93341eb5ce21fd8a119e9dbdd'
UPSTREAM='https://github.com/kstenerud/Musashi.git'
EXPORTS=[
 'pwp_mu_stage_ptr','pwp_mu_stage_capacity','pwp_mu_reset','pwp_mu_load',
 'pwp_mu_run','pwp_mu_dispatch','pwp_mu_register','pwp_mu_pc',
 'pwp_mu_steps','pwp_mu_status','pwp_mu_trap','pwp_mu_trap_pc',
 'pwp_mu_fault_address','pwp_mu_image_end','pwp_mu_bss_end',
 'pwp_mu_guest_peek32','pwp_mu_set_pan_size','pwp_mu_io_stage_ptr',
 'pwp_mu_io_capacity','pwp_mu_io_offset_high','pwp_mu_io_offset_low',
 'pwp_mu_io_length','pwp_mu_supply_read','pwp_mu_console_length',
 'pwp_mu_console_byte','pwp_mu_console_truncated','pwp_mu_exit_code',
 'pwp_mu_video_text_index','pwp_mu_video_palette_word','pwp_mu_video_write_count','pwp_mu_video_graphic_word']
def exe(s):
    p=shutil.which(s)
    if not p: raise RuntimeError(f'Required tool missing: {s}')
    return p
def run(cmd,**kw):
    print('+',' '.join(map(str,cmd)),flush=True)
    subprocess.run([str(x) for x in cmd],check=True,**kw)
def rev(git,path):
    return subprocess.check_output([git,'-C',str(path),'rev-parse','HEAD'],text=True).strip()
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,help='Existing read-only upstream Musashi Git checkout at exact pinned HEAD')
    parser.add_argument('--offline',action='store_true',help='Fail if neither --source nor existing pinned work checkout is available')
    opts=parser.parse_args()
    git=exe('git')
    if opts.source:
        src=opts.source.expanduser().resolve()
        if not (src/'.git').exists():raise RuntimeError(f'Not a Git checkout: {src}')
        if rev(git,src)!=PIN:raise RuntimeError('User source is not at the required Musashi upstream commit. Refusing unverified fork.')
        if WORK.exists():
            if rev(git,WORK)!=PIN:raise RuntimeError('Existing work copy commit mismatch; refusing overwrite.')
        else:
            WORK.parent.mkdir(parents=True,exist_ok=True)
            run([git,'clone','--local','--no-hardlinks','--no-checkout',src,WORK])
            run([git,'-C',WORK,'checkout','--detach',PIN])
    elif not WORK.exists():
        if opts.offline:raise RuntimeError('Offline and no already-verified Musashi checkout. STOP.')
        WORK.parent.mkdir(parents=True,exist_ok=True)
        run([git,'clone','--no-checkout',UPSTREAM,WORK])
        run([git,'-C',WORK,'checkout','--detach',PIN])
    if rev(git,WORK)!=PIN:raise RuntimeError('Pinned Musashi revision mismatch')
    for name in ['m68kcpu.c','m68kmake.c','m68k_in.c','m68k.h','softfloat/softfloat.c']:
        if not (WORK/name).is_file():raise RuntimeError('Missing upstream: '+name)
    emcc=exe(os.environ.get('EMCC','emcc'))
    cc=exe(os.environ.get('PWP_HOST_CC','gcc'))
    generator=WORK/('pwp_m68kmake.exe' if os.name=='nt' else 'pwp_m68kmake')
    run([cc,'-O2',WORK/'m68kmake.c','-o',generator])
    run([generator],cwd=WORK)
    for name in ('m68kops.c','m68kops.h'):
        if not (WORK/name).is_file() or not (WORK/name).stat().st_size:raise RuntimeError('Missing generated '+name)
    out=ROOT/'core'/'pwp_musashi.mjs'
    cmd=[emcc,'-O2','-std=gnu11','-I',WORK,
         '-DM68K_EMULATE_010=0','-DM68K_EMULATE_EC020=0',
         '-DM68K_EMULATE_020=0','-DM68K_EMULATE_030=0','-DM68K_EMULATE_040=0',
         '-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,worker,node',
         '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=16777216','-sMAXIMUM_MEMORY=67108864',
         '-sFILESYSTEM=0',
         '-sEXPORTED_FUNCTIONS='+str(['_'+x for x in EXPORTS]).replace(' ','').replace('"',"'"),
         '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]','--no-entry',
         ROOT/'core/pwp_musashi.c', ROOT/'core/pwp_x68k_video_bus.c',
         WORK/'m68kcpu.c',WORK/'m68kops.c',WORK/'softfloat/softfloat.c',
         '-lm','-o',out]
    run(cmd)
    if not out.is_file() or not out.with_suffix('.wasm').is_file():raise RuntimeError('Build artifacts absent')
    print('BUILD PASS actual Musashi WASM. PAN playback/video/audio guest execution remains separately unverified.')
if __name__=='__main__':main()
