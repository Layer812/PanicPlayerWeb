#!/usr/bin/env python3
"""R11 pinned real-CPU build, authentic PANIC.X, startup command-line gate.

No fake CPU, no ROM, no Tab5 Production changes. All generated artifacts stay
inside this independent PanicPlayerWeb_R11 tree. Full playback remains gated.
"""
import argparse
import hashlib
import os
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PIN_X='f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'

def find_source(explicit, tab5_root):
    if explicit:
        path=Path(explicit).expanduser().resolve()
        if not path.is_file():raise SystemExit(f'SAFE STOP: PANIC source not found: {path}')
        return path
    roots=[]
    if tab5_root:roots.append(Path(tab5_root))
    # Only trusted, named candidates; never walk or modify a user drive.
    if os.name=='nt':
        roots.extend([Path('G:/X68KTab5'),Path('G:/X68KTab'),
                      Path('G:/X68K_Tab5'),Path('G:/X68KTAB')])
    for root in roots:
        candidate=root/'src'/'panic_x_bin.c'
        if candidate.is_file():return candidate.resolve()
    return None

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--x68ktab-root',help='Read-only local X68KTab5 source root')
    ap.add_argument('--panic-source',default=os.environ.get('PWP_X68KTAB_PANIC_C'))
    ap.add_argument('--panic-x',default=os.environ.get('PWP_PANIC_X'))
    ap.add_argument('--musashi-source',default=os.environ.get('PWP_MUSASHI_SOURCE'))
    ap.add_argument('--offline',action='store_true')
    a=ap.parse_args()
    if a.panic_x and a.panic_source:ap.error('Choose either --panic-x or --panic-source')
    x=Path(a.panic_x).expanduser().resolve() if a.panic_x else ROOT/'core'/'PANIC.X'
    if a.panic_x:
        if not x.is_file():raise SystemExit('SAFE STOP: original PANIC.X is missing')
    elif a.panic_source or a.x68ktab_root or not x.is_file():
        source=find_source(a.panic_source,a.x68ktab_root)
        if not source:
            if x.is_file() and a.x68ktab_root:
                raise SystemExit('SAFE STOP: explicit --x68ktab-root lacks src/panic_x_bin.c')
            if not x.is_file():
                raise SystemExit('SAFE STOP: original PANIC.X is missing. Supply --panic-x or --panic-source, or --x68ktab-root (local X68KTab5).')
        else:
            from EXTRACT_PANIC_X import extract
            raw=extract(source.read_text(encoding='utf-8'))
            if hashlib.sha256(raw).hexdigest()!=PIN_X:
                raise SystemExit('SAFE STOP: source PANIC.X SHA256 differs from known V1.38')
            if x.is_file():
                if x.read_bytes()!=raw:raise SystemExit('SAFE STOP: prior PANIC.X differs from the chosen source; never overwrite')
            else:
                x.write_bytes(raw)
                print(f'PANIC.X staged from verified read-only source: {source}',flush=True)
    if hashlib.sha256(x.read_bytes()).hexdigest()!=PIN_X:
        raise SystemExit('SAFE STOP: PANIC.X original SHA-256 mismatch')
    cmd=[sys.executable,str(ROOT/'tools'/'BUILD_R9_MUSASHI.py'),'--panic-x',str(x)]
    if a.musashi_source:cmd+=['--source',str(Path(a.musashi_source).expanduser().resolve())]
    if a.offline:cmd.append('--offline')
    print('R11 real Musashi CPU + original PANIC.X + A2 LASCII STARTUP GATE',flush=True)
    print('R11 source selection never changes the X68KTab5 project.',flush=True)
    rc=subprocess.call(cmd,cwd=ROOT)
    if rc:raise SystemExit(f'SAFE STOP: actual CPU build/boot check failed (rc={rc})')
    for output in ['pwp_musashi.mjs','pwp_musashi.wasm']:
        if not (ROOT/'core'/output).is_file():raise SystemExit(f'SAFE STOP: output missing: {output}')
    if (ROOT/'core'/'pwp_musashi.wasm').read_bytes()[:4]!=b'\0asm':
        raise SystemExit('SAFE STOP: invalid WebAssembly magic')
    # The R9 boot-test source in this release ALSO verifies A2, LASCII bytes,
    # basename, and terminating NUL in guest memory before CPU acceptance.
    print('PASS: REAL Musashi WASM startup, authentic PANIC.X, A2 command line and first DOS _SETBLOCK')
    print('NOT PASS: Full PAN animation playback, IOCS/video sprites/audio/timing (not implemented).')

if __name__=='__main__':main()
