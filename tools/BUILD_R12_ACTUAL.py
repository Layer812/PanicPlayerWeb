#!/usr/bin/env python3
"""R12: locally sourced, real Musashi -> WASM -> executable acceptance gates.

Never writes into X68KTab5. Copies the exact supplied Musashi files into a
private snapshot. Never publishes wasm/js output before authentic CPU smoke
and original PANIC.X boot verification. No fake CPU, no unverified PASS.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN_X = 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'
TAB5_PARTS = (
    'm68kcpu.c','m68kcpu.h','m68kops.c','m68kops.h','m68k.h','m68kconf.h',
    'm68kfpu.c','m68kmmu.h','softfloat/softfloat.c','softfloat/softfloat.h',
    'softfloat/milieu.h','softfloat/mamesf.h','softfloat/softfloat-macros',
    'softfloat/softfloat-specialize',
)
# Copied from the pinned upstream R9 builder so the exact browser ABI is fixed.
from BUILD_R9_MUSASHI import EXPORTS
from PATCH_R15_FIX3_CPU_FETCH import patch_private_copy


def invoke(args, cwd=None):
    print('+', ' '.join(map(str, args)), flush=True)
    subprocess.run([str(a) for a in args], cwd=cwd, check=True)


def source_dir(opts):
    if opts.tab5_musashi_source:
        return Path(opts.tab5_musashi_source).expanduser().resolve(strict=True)
    roots = [Path(opts.x68ktab_root)] if opts.x68ktab_root else []
    if os.name == 'nt' and not roots:
        roots.extend(map(Path, ('G:/X68KTab5', 'G:/X68KTab', 'G:/X68K_Tab5', 'G:/X68KTAB')))
    for root in roots:
        candidate = root / 'components' / 'px68k' / 'm68000' / 'musashi'
        if candidate.is_dir():
            return candidate.resolve(strict=True)
    raise RuntimeError('No Tab5 Musashi source found. Specify --x68ktab-root or --tab5-musashi-source. Production remains untouched.')


def manifest(source):
    if not source.is_dir():
        raise RuntimeError(f'Musashi source is not a directory: {source}')
    return {f: hashlib.sha256((source/f).read_bytes()).hexdigest() for f in TAB5_PARTS}


def verified_pan(opts):
    x = (Path(opts.panic_x).expanduser().resolve() if opts.panic_x
         else ROOT/'core'/'PANIC.X')
    if x.is_file():
        data=x.read_bytes()
        if hashlib.sha256(data).hexdigest() != PIN_X:
            raise RuntimeError(f'PANIC.X SHA256 mismatch; will not run: {x}')
        return x
    if opts.panic_x:
        raise RuntimeError(f'Explicit PANIC.X absent: {x}')
    source = Path(opts.panic_source).expanduser().resolve() if opts.panic_source else None
    if source is None and opts.x68ktab_root:
        source=Path(opts.x68ktab_root)/'src'/'panic_x_bin.c'
    if source is None:
        for root in map(Path, ('G:/X68KTab5','G:/X68KTab')):
            if (root/'src'/'panic_x_bin.c').is_file():
                source=root/'src'/'panic_x_bin.c'; break
    if not source or not source.is_file():
        raise RuntimeError('Verified original PANIC.X missing. Specify --panic-source or --panic-x, or local X68KTab5 root.')
    sys.path.insert(0,str(ROOT/'tools'))
    from EXTRACT_PANIC_X import extract
    data=extract(source.read_text(encoding='utf-8'))
    if hashlib.sha256(data).hexdigest()!=PIN_X:
        raise RuntimeError('Embedded PANIC.X source SHA256 is not the expected V1.38')
    # The binary is only staged inside the private R12 tree, never installed
    # to the original repo. Do not overwrite an existing file.
    x.parent.mkdir(parents=True, exist_ok=True)
    with x.open('xb') as out:
        out.write(data)
    return x


def compile_and_test(opts, source, x):
    emcc=shutil.which(os.environ.get('EMCC','emcc'))
    node=shutil.which(os.environ.get('PWP_NODE','node'))
    if not emcc: raise RuntimeError('Emscripten emcc unavailable; actual WASM build was NOT attempted')
    if not node: raise RuntimeError('Node.js unavailable; real CPU execution cannot be verified')
    src_manifest=manifest(source)  # missing files STOP before any build publication
    if opts.experimental_zmusic and not (ROOT/'core'/'pwp_zm2_preboot.inc').is_file():
        raise RuntimeError('Experimental boot source absent')
    # Actual source files and local source itself are NEVER edited. Two
    # temporary directories in R12 isolate input snapshot and output stage.
    vendor=ROOT/'vendor'; vendor.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pwp_r12_',dir=vendor) as temp:
        work=Path(temp)
        snap=work/'musashi'
        snap.mkdir()
        for name in TAB5_PARTS:
            dest=snap/name; dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(source/name,dest)
        if manifest(snap)!=src_manifest:
            raise RuntimeError('Source snapshot hashes differ; aborting to avoid mixed revisions')
        patch_record = patch_private_copy(snap/'m68kcpu.c')
        print('PASS isolated non-ESP fetch restoration:', patch_record, flush=True)
        out=work/'pwp_musashi.mjs'
        exports=EXPORTS+(['pwp_mu_tsr_begin','pwp_mu_tsr_phase','pwp_mu_tsr_steps'] if opts.experimental_zmusic else [])
        flags=['-DPWP_EXPERIMENTAL_ZM2=1'] if opts.experimental_zmusic else []
        sources=[ROOT/'core'/'pwp_hu_resident.c'] if opts.experimental_zmusic else []
        cmd=[emcc,'-O2','-std=gnu11','-I',snap,'-I',snap/'softfloat',*flags,
             '-DPWP_TAB5_MUSASHI=1',
             '-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,worker,node',
             '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=33554432',
             '-sMAXIMUM_MEMORY=67108864','-sFILESYSTEM=0',
             '-sEXPORTED_FUNCTIONS='+str(['_'+n for n in exports]).replace(' ','').replace('"',"'"),
             '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]','--no-entry',
             ROOT/'core'/'pwp_musashi.c',ROOT/'core'/'pwp_x68k_video_bus.c',
             ROOT/'core'/'pwp_x68k_frame.c',*sources,snap/'m68kcpu.c',snap/'m68kops.c',
             snap/'softfloat'/'softfloat.c','-lm','-o',out]
        invoke(cmd)
        wasm=out.with_suffix('.wasm')
        if not out.is_file() or not wasm.is_file() or wasm.read_bytes()[:4]!=b'\0asm':
            raise RuntimeError('Actual Musashi WASM outputs missing or invalid')
        # No fake CPU is ever accepted. The genuine code must execute a
        # synthetic HU AND the authentic PANIC.X up to the first DOS service.
        invoke([node,ROOT/'tools'/'RUN_R9_CPU_SMOKE.mjs',out])
        if opts.experimental_zmusic:
            invoke([node,ROOT/'tools'/'RUN_ZM2_REAL_TSR_CPU.mjs',out])
            if opts.zmusic_driver:
                invoke([node,ROOT/'tools'/'RUN_ZM2_REAL_DRIVER_PROBE.mjs',out,opts.zmusic_driver])
                invoke([node,ROOT/'tools'/'RUN_ZM2_BROWSER_BRIDGE.mjs',
                        out,opts.zmusic_driver,ROOT/'core'/'PANIC.X'])
            print('PASS isolated genuine Musashi TSR boot API; real ZMUSIC residency is NOT yet claimed')
            return  # Never publish experimental WASM to core/ or GitHub Pages.
        invoke([node,ROOT/'tools'/'RUN_R9_PANIC_BOOT.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R14_WASM_GUEST_IO.mjs',out])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX4_SUPER_CPU.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX5_MFP_CPU.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX6_TGUSEMD_CPU.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX7_MSINIT_CPU.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX8_NAMECK_CPU.mjs',out,x])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX9_CONCTRL_CPU.mjs',out])
        invoke([node,ROOT/'tools'/'RUN_FIX45_SPACE_REAL_CPU.mjs',out])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX10_CRTMOD_CPU.mjs',out])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX11_GCLR_CPU.mjs',out])
        invoke([node,ROOT/'tools'/'RUN_R16_FIX12_SPRITE_CPU.mjs',out])
        # Observe the real PANIC.X beyond FF4A with no user PAN data.
        # This is evidence, NOT an animation playback PASS. Unsupported IOCS,
        # incomplete video and EOF remain explicit in the JSON trace.
        deep_report=ROOT/'R16_PANIC_DEEP_TRACE.json'
        deeper=subprocess.run([str(node),str(ROOT/'tools'/'RUN_R16_PANIC_DEEP.mjs'),
                               str(out),str(x),'--out',str(deep_report)],check=False)
        print('R16 genuine PANIC.X deep runtime trace rc=',deeper.returncode,flush=True)
        # R16 browser ABI requires a genuine actual guest pixel write counter.
        # Do not publish a previous core that could fake a visible first frame.
        # Do not use any marker from previous build as evidence. Publish only
        # now, after BOTH actual CPU tests pass.
        for f in (out,wasm):
            shutil.copy2(f,ROOT/'core'/f.name)
        record={
            'status':'REAL_MUSASHI_PANIC_BOOT_PASS',
            'source_path':str(source),
            'source_files_sha256':src_manifest,
            'source_flavor':'X68KTab5 local Musashi (not upstream pinned)',
            'panic_x_sha256':PIN_X,
            'wasm_sha256':hashlib.sha256(wasm.read_bytes()).hexdigest(),
            'tests':['real CPU synthetic HU smoke', 'real PANIC.X FF4A boot + A2 LASCII', 'real 68000 guest file I/O OPEN/READ/SEEK/CLOSE in WASM',
                     'real PANIC.X DOS _SUPER and synthetic privilege stack round-trip in WASM', 'real PANIC.X MFP IERB/IMRB register reads and instruction advancement in WASM', 'real PANIC.X IOCS $0E first query in WASM', 'real PANIC.X IOCS $70 _MS_INIT in WASM', 'real PANIC.X FF37 _NAMECK 91-byte expansion in WASM', 'real Musashi synthetic HU DOS _CONCTRL verified mode 16/14/17/18', 'real Musashi IOCS CRTMOD mode10 & query in WASM', 'real Musashi IOCS G_CLR_ON graphics clear and display in WASM', 'real Musashi sprite/BG IOCS $C0 _SP_INIT and $C1 _SP_ON subset in WASM'],
            'super_gate':'REAL_MUSASHI_WASM_SUPER_ROUNDTRIP_PASS',
            'mfp_gate':'REAL_MUSASHI_WASM_PANIC_MFP_READ_PASS',
            'iocs_gate':'REAL_MUSASHI_WASM_PANIC_TGUSEMD_PASS',
            'mouse_gate':'REAL_MUSASHI_WASM_PANIC_MS_INIT_PASS',
            'nameck_gate':'REAL_MUSASHI_WASM_PANIC_NAMECK_PASS',
            'conctrl_gate':'REAL_MUSASHI_WASM_CONCTRL_SEMANTICS_PASS',
            'crtmod_gate':'REAL_MUSASHI_WASM_CRTMOD10_SEMANTICS_PASS',
            'gclr_gate':'REAL_MUSASHI_WASM_GCLR_ON10_SEMANTICS_PASS',
            'sprite_gate':'REAL_MUSASHI_WASM_SPRITE_INIT_ON10_SEMANTICS_PASS',
            'not_tested':['full PAN movie', 'sprite/BG priority', 'sound', 'frame cadence'],
            'r16_deep_trace':'R16_PANIC_DEEP_TRACE.json (trace is evidence, not playback acceptance)',
        }
        (ROOT/'R12_REAL_CPU_MANIFEST.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('PASS R12: real Tab5-derived Musashi WASM executes CPU smoke and genuine PANIC.X startup.')
        print('NOT PASS: PAN movie display/audio full playback.')


def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--x68ktab-root',help='Read-only X68KTab5 source checkout (e.g. G:\\X68KTab5)')
    a.add_argument('--tab5-musashi-source',help='Read-only directory that holds m68kcpu.c/m68kops.c')
    a.add_argument('--experimental-zmusic',action='store_true',help='Isolated real TSR boot; not Pages')
    a.add_argument('--zmusic-driver',help='Hash-verified real ZMUSIC208.X for boot observation')
    a.add_argument('--panic-source',help='Local src/panic_x_bin.c, read-only')
    a.add_argument('--panic-x',help='Authentic original PANIC.X, read-only')
    opts=a.parse_args()
    try:
        source=source_dir(opts)
        # Check Emscripten before extracting/staging PANIC.X into output tree:
        # source-only machines should not leave a stray executable payload.
        if not shutil.which(os.environ.get('EMCC','emcc')):
            raise RuntimeError('Emscripten emcc is unavailable; cannot build real CPU')
        manifest(source)
        x=verified_pan(opts)
        compile_and_test(opts,source,x)
    except (RuntimeError,FileNotFoundError,subprocess.CalledProcessError,OSError) as e:
        raise SystemExit(f'SAFE STOP R12: {e}')

if __name__=='__main__':main()
