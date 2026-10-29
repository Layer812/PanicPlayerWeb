#!/usr/bin/env python3
"""Build a PRIVATE, loopback-only Windows browser preview from verified CI
WASM. This intentionally excludes ZMUSIC208.X and any .PAN media.
No Github Pages deployment, no production binary replacement.
Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT=Path(__file__).resolve().parent.parent
STAGE=ROOT/'_preview_stage'
CORE=STAGE/'core'
YMFM=ROOT/'_ymfm'

RUN_CMD=r"""@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  python preview_server.py
) else (
  py -3 preview_server.py
)
pause
"""
SERVER=r"""# Bound to loopback only; no external or LAN access.
# Copyright (c) 2026 Layer812. SPDX-License-Identifier: MIT.
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from pathlib import Path
import webbrowser
HOST='127.0.0.1'
PORT=8765
root=Path(__file__).resolve().parent
handler=partial(SimpleHTTPRequestHandler,directory=str(root))
try:
    with ThreadingHTTPServer((HOST,PORT),handler) as server:
        url=f'http://{HOST}:{PORT}/?zmusic=1'
        print('Panic Player Web - ORIGINAL Z-MUSIC / YM2151 LOCAL PREVIEW')
        print('Open:',url)
        print('Choose denkozm.pan and click PLAY to enable WebAudio.')
        print('Press Ctrl+C to stop the local server.')
        webbrowser.open(url)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
except OSError as e:
    raise SystemExit('Local preview port 8765 unavailable: '+str(e))
"""
README="""# Panic Player Web — Z-MUSIC 2.08 + YM2151 local preview

**2026-10-29 / experimental, not a production release**

This preview contains the real Musashi 68000 WASM and a BSD-licensed
Aaron Giles ymfm YM2151 core, built only after actual original-PAN
regressions. It is NOT deployed to GitHub Pages.

Windows quick start:
1. Extract the entire artifact ZIP to one folder.
2. Double-click RUN_ZMUSIC_PREVIEW.cmd (requires Python 3 / py launcher).
3. The default browser opens http://127.0.0.1:8765/?zmusic=1
4. Select denkozm.pan from the GitHub PAN list and press PLAY.
   Alternatively use a PAN file already on your PC.
5. STOP stops guest playback; Ctrl+C closes the Python server.

Actual sound:
- denkozm.pan : original PANIC.X -> actual Z-MUSIC 2.08 TSR -> OPM IRQ
                 -> ymfm YM2151 stereo waveform.
- denkofm.pan : original PANIC.X direct YM2151 -> real stereo waveform.
- denkopcm.pan: original PANIC.X ADPCM -> real decoded PCM.

The original ZMUSIC208.X is NOT included in this artifact. Explicit local
preview opt-in (?zmusic=1) fetches exactly the fixed, hash-verified
upstream original at initialization. Internet access to raw.githubusercontent.com
is needed for the driver; the GitHub PAN catalog also requires network,
but locally provided PAN files do not get uploaded.

The bundled PANIC.X is already available from the Layer812 repository and
retains its original copyright/license (see LICENSE_PANIC_X.txt).
The ymfm-derived WASM is under BSD-3-Clause, with complete copyright and
disclaimer in YMFM_BSD_3_CLAUSE.txt. Do not imply endorsement by upstream.
Other notices are in THIRD_PARTY_NOTICES.md.

Limitations:
- Not verified by human in-browser listening.
- Real guest cycle pacing, renderer timing, AudioContext autoplay behavior
  and device/browser-dependent A/V synchronization need user testing.
- Real PAN acceptance covers approximately eight seconds per source,
  not the full movie duration.
- The experimental core is NOT merged into Production main.
- NO full X68000 emulator, no filesystem boot / AUTOEXEC.BAT.

This zip contains no Z-MUSIC executable and NO bundled .PAN media.
"""

def main():
    wasm=CORE/'pwp_musashi.wasm'
    loader=CORE/'pwp_musashi.mjs'
    src=ROOT/'src'
    license=YMFM/'LICENSE'
    for item in [wasm,loader,ROOT/'core'/'PANIC.X',ROOT/'index.html',
                 src/'main.js',src/'engine-loader.js',license]:
        if not item.is_file() or item.stat().st_size==0:
            raise SystemExit('Local preview input missing: '+str(item))
    if wasm.read_bytes()[:4]!=b'\x00asm':
        raise SystemExit('Refusing invalid experimental WASM')
    if b'BSD 3-Clause License' not in license.read_bytes():
        raise SystemExit('Refusing preview without exact original ymfm license')
    if ('isZmusicEnabled(location)' not in (src/'main.js').read_text(encoding='utf-8') or
        'isLocalZmusicPreview' not in (src/'engine-loader.js').read_text(encoding='utf-8')):
        raise SystemExit('Verified local/public Z-MUSIC gating is missing; no preview')

    shutil.copytree(src,STAGE/'src',dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    for name in ['index.html','LICENSE','LICENSE_PANIC_X.txt',
                 'PANIC_V1.38_NOTICE.txt','THIRD_PARTY_NOTICES.md',
                 'THIRD_PARTY_NOTICES.html']:
        shutil.copyfile(ROOT/name,STAGE/name)
    shutil.copyfile(ROOT/'core'/'PANIC.X',CORE/'PANIC.X')
    shutil.copyfile(license,STAGE/'YMFM_BSD_3_CLAUSE.txt')
    (STAGE/'RUN_ZMUSIC_PREVIEW.cmd').write_text(RUN_CMD,encoding='utf-8')
    (STAGE/'preview_server.py').write_text(SERVER,encoding='utf-8')
    (STAGE/'PREVIEW_README.md').write_text(README,encoding='utf-8')
    # Never ship full copyrighted Z-MUSIC guest code or the PAN movies.
    forbidden=list(STAGE.rglob('ZMUSIC*.X')) + list(STAGE.rglob('*.pan'))
    forbidden+=list(STAGE.rglob('*.PAN'))
    if forbidden:
        raise SystemExit('Unexpected third-party driver or PAN in preview: '+str(forbidden))
    manifest={
       'format':'PWP-ZM2-LOCAL-PREVIEW-v1',
       'experimental':True,'pagesDeployment':False,
       'ymfmGitCommit':'81aec25ccbb98f4873a255f7551ac4dadac59b4a',
       'bundledZmusicDriver':False,'bundledPan':False,
       'sha256Wasm':hashlib.sha256(wasm.read_bytes()).hexdigest(),
       'sha256PanicX':hashlib.sha256((CORE/'PANIC.X').read_bytes()).hexdigest(),
    }
    (STAGE/'PREVIEW_BUILD_INFO.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('PASS local preview packaging (not deployed; original PAN and driver excluded)')
    print('Real experimental WASM SHA256:',manifest['sha256Wasm'])

if __name__=='__main__':main()
