#!/usr/bin/env python3
"""One-step build + run. No mock, no hardware writes, no SDK installation."""
from __future__ import annotations
from pathlib import Path
import argparse, json, hashlib, os, subprocess,sys
from R16_SDK_ENV import resolve_compiler
ROOT=Path(__file__).resolve().parents[1]
PIN='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'
# FIX20: a valid old .wasm is not proof it was built from THIS source tree.
# Prior launcher checked only its own manifest and unknowingly reused earlier
# compiled VC/CRTC semantics. Force a one-time rebuild if any actual compiled
# adapter or its build rules differ, then reuse only an exact source fingerprint.
BUILD_DEPS=[
 'core/pwp_musashi.c','core/pwp_x68k_video_bus.c','core/pwp_x68k_frame.c',
 'core/pwp_x68k_video_bus.h','core/pwp_x68k_frame.h',
 'tools/BUILD_R12_ACTUAL.py','tools/BUILD_R9_MUSASHI.py',
 'tools/PATCH_R15_FIX3_CPU_FETCH.py',
]
def source_fingerprint():
    return {rel:sha(ROOT/rel) for rel in BUILD_DEPS}


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source',type=Path,default=Path('G:/X68KTab5'))
    p.add_argument('--pan',type=Path,default=Path('G:/panicplayer/PELSIA01.PAN'))
    a=p.parse_args()
    source=a.source.resolve(strict=True);pan=a.pan.resolve(strict=True)
    if pan.suffix.lower()!='.pan':raise RuntimeError('Not a .PAN file: '+str(pan))
    if not (source/'src/panic_x_bin.c').is_file():raise RuntimeError('Source PANIC.X missing')
    manifest=ROOT/'R12_REAL_CPU_MANIFEST.json';wasm=ROOT/'core/pwp_musashi.wasm';glue=ROOT/'core/pwp_musashi.mjs';hu=ROOT/'core/PANIC.X'
    stamp=ROOT/'FIX25_BUILD_FINGERPRINT.json'
    expected=source_fingerprint()
    current=(manifest.is_file() and wasm.is_file() and glue.is_file() and hu.is_file() and sha(hu)==PIN and stamp.is_file())
    if current:
        try:
            m=json.loads(manifest.read_text('utf8'))
            st=json.loads(stamp.read_text(encoding='utf-8'))
            current= (m.get('wasm_sha256')==sha(wasm) and m.get('status')=='REAL_MUSASHI_PANIC_BOOT_PASS'
                and m.get('source_flavor','').startswith('X68KTab5')
                and st.get('build_deps_sha256')==expected
                and st.get('wasm_sha256')==sha(wasm))
        except Exception:current=False
    if not current:
        sdk=[];env,compiler=resolve_compiler(ROOT,sdk)
        if not compiler:raise RuntimeError('Existing Emscripten compiler unavailable; SDK was not installed')
        print('Building actual Musashi and original PANIC.X using existing SDK',flush=True)
        subprocess.run([sys.executable,str(ROOT/'tools/BUILD_R12_ACTUAL.py'),'--x68ktab-root',str(source)],check=True,cwd=ROOT,env=env)
    if not (manifest.is_file() and wasm.is_file() and glue.is_file() and hu.is_file()
            and sha(hu)==PIN and json.loads(manifest.read_text('utf8')).get('wasm_sha256')==sha(wasm)):
        raise RuntimeError('Verified Musashi build artifacts missing or changed')
    if not current:
        stamp.write_text(json.dumps({'build_deps_sha256':expected,'wasm_sha256':sha(wasm)},indent=2)+'\n',encoding='utf-8')
    print('PASS FIX36 16MHz actual Musashi WASM and compiled display source fingerprint',flush=True)
    print('Starting actual browser player. No file content has been bundled.',flush=True)
    subprocess.run([sys.executable,str(ROOT/'tools/PLAY_LOCAL.py'),'--pan',str(pan)],check=True,cwd=ROOT)

if __name__=='__main__':
    try:main()
    except (RuntimeError, FileNotFoundError, subprocess.CalledProcessError) as e:raise SystemExit('SAFE STOP: '+str(e))
