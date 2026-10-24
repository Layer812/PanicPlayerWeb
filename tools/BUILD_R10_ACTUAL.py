#!/usr/bin/env python3
"""R10 one-command full CPU build, acceptance and optional PANIC.X extraction.

Does not alter upstream X68K Tab or PanicPlayerTab5. There is NO emulated CPU
fallback. Promotes WASM only after real Musashi instruction smoke passes.
The UI will still be experimental: complete video/audio/IOCS not yet ready.
"""
import argparse
import hashlib
import os
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PIN_X = 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--musashi-source',default=os.environ.get('PWP_MUSASHI_SOURCE'),help='Optional exact pinned Git checkout')
    p.add_argument('--panic-source',default=os.environ.get('PWP_X68KTAB_PANIC_C'),help='Your X68KTab5/src/panic_x_bin.c')
    p.add_argument('--panic-x',default=os.environ.get('PWP_PANIC_X'),help='Existing original PANIC.X V1.38')
    p.add_argument('--offline',action='store_true')
    a=p.parse_args()
    if a.panic_source and a.panic_x: p.error('Choose either --panic-source or --panic-x, not both')
    x=Path(a.panic_x).resolve() if a.panic_x else ROOT/'core'/'PANIC.X'
    if a.panic_source:
        from EXTRACT_PANIC_X import extract
        raw=extract(Path(a.panic_source).read_text(encoding='utf8'))
        if hashlib.sha256(raw).hexdigest()!=PIN_X:
            raise SystemExit('SAFE STOP: PANIC.X source is NOT exact known V1.38 SHA-256')
        if x.exists():
            if x.read_bytes()!=raw:raise SystemExit('SAFE STOP: existing PANIC.X differs; never overwrite')
        else:
            x.write_bytes(raw)
            print('PANIC.X extracted into local developer core/ (excluded from release archive)')
    if not x.is_file():
        raise SystemExit('SAFE STOP: supply authentic PANIC.X with --panic-source or --panic-x')
    if hashlib.sha256(x.read_bytes()).hexdigest()!=PIN_X:
        raise SystemExit('SAFE STOP: PANIC.X SHA-256 mismatch')
    cmd=[sys.executable,str(ROOT/'tools'/'BUILD_R9_MUSASHI.py'),'--panic-x',str(x)]
    if a.offline:cmd.append('--offline')
    if a.musashi_source:cmd+=['--source',str(Path(a.musashi_source).resolve())]
    print('BUILDING real pinned Musashi + original PANIC.X startup test',flush=True)
    proc=subprocess.run(cmd,cwd=ROOT)
    if proc.returncode:raise SystemExit(f'SAFE STOP: real CPU build/test failed ({proc.returncode}). No acceptance claim.')
    assert (ROOT/'core'/'pwp_musashi.wasm').read_bytes()[:4]==b'\0asm'
    print('PASS: real Musashi CPU synthetic and authentic PANIC.X startup tests passed.')
    print('NOT VERIFIED: full PAN video, IOCS, sprites, audio, timing, SPACE.')
if __name__=='__main__':main()
