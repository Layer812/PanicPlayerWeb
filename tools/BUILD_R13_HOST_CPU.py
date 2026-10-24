#!/usr/bin/env python3
"""Build+run actual local Tab5 Musashi natively, without requiring Emscripten.

Read-only local source. All compiled inputs are SHA-256 recorded and isolated
outside the original Tab5 project. A mock core can NEVER satisfy the tests.
This host-stage gate precedes any Emscripten WASM gate, it does not replace it.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
from BUILD_R12_ACTUAL import source_dir, manifest, TAB5_PARTS, PIN_X
from PATCH_R15_FIX3_CPU_FETCH import patch_private_copy
from EXTRACT_PANIC_X import extract


def invoke(cmd, cwd=None):
    print('+', ' '.join(map(str,cmd)), flush=True)
    subprocess.run([str(a) for a in cmd], cwd=cwd, check=True)



def validate_real_native_proof(result):
    """R16 FIX3: Require the stronger real-CPU _SETBLOCK + 256KiB _MALLOC
    evidence. The R13 gate previously compared the obsolete FIRST_DOS_PASS
    label, rejecting an actual successful verified allocation. Do NOT accept
    the old, weaker label as sufficient for the R16 memory bootstrap.
    """
    if not isinstance(result, dict) or result.get('result') != (
            'REAL_NATIVE_MUSASHI_SYNTHETIC_AND_PANIC_MALLOC_PASS'):
        raise RuntimeError('Real native CPU did not verify PANIC.X 256KiB allocation')
    p = result.get('panic')
    if not isinstance(p, dict):
        raise RuntimeError('Real native CPU proof has no PANIC.X allocation record')
    end = p.get('program_end')
    ptr = p.get('malloc_d0')
    required = (result.get('panic_sha256') == PIN_X
                and p.get('first_dos') == 'FF4A'
                and p.get('trap_pc') == '0x10012'
                and p.get('setblock_d0') == 0
                and p.get('startup_workspace_bytes') == 0x40000
                and isinstance(p.get('instructions_executed'), int)
                and p['instructions_executed'] >= 6
                and type(end) is int and end == 0x15366
                and type(ptr) is int and end <= ptr < 0x3f0000 - 0x40000)
    if not required:
        raise RuntimeError('Real native CPU allocation evidence incomplete or invalid')
    print('PASS R16 FIX3 native proof: genuine PANIC.X FF4A and 256KiB FF48 workspace', flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--x68ktab-root', help='Read-only X68KTab5 checkout root')
    p.add_argument('--tab5-musashi-source', help='Exact read-only Musashi directory')
    p.add_argument('--panic-source', help='Exact read-only path to panic_x_bin.c')
    p.add_argument('--panic-x', help='Read-only authentic PANIC.X (alternative)')
    p.add_argument('--cc', help='Host C compiler; defaults to PWP_HOST_CC or gcc/clang')
    opt=p.parse_args()
    evidence=ROOT/'R13_REAL_HOST_CPU_EVIDENCE.json'
    evidence.unlink(missing_ok=True)
    source=source_dir(opt)
    sums=manifest(source)
    cc=(shutil.which(opt.cc) if opt.cc else
        shutil.which(os.environ.get('PWP_HOST_CC','gcc')) or shutil.which('clang'))
    if not cc: raise RuntimeError('Host GCC/Clang unavailable; no real native CPU built')
    if opt.panic_x:
        panic=Path(opt.panic_x).resolve(strict=True).read_bytes()
    else:
        source_path = Path(opt.panic_source) if opt.panic_source else (
            Path(opt.x68ktab_root)/'src'/'panic_x_bin.c' if opt.x68ktab_root else
            source.parents[3]/'src'/'panic_x_bin.c')
        panic=extract(source_path.read_text(encoding='utf-8'))
    if hashlib.sha256(panic).hexdigest()!=PIN_X:
        raise RuntimeError('Authentic PANIC.X SHA256 does not match; no test')

    vendor=ROOT/'vendor'
    vendor.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=vendor,prefix='r13_real_musashi_') as t:
        temp=Path(t)
        snap=temp/'musashi'
        snap.mkdir()
        for part in TAB5_PARTS:
            dst=snap/part;dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(source/part,dst)
        if sums!=manifest(snap):
            raise RuntimeError('Musashi snapshot differs from source: fail-closed')
        patch_record = patch_private_copy(snap/'m68kcpu.c')
        print('PASS isolated non-ESP fetch restoration:', patch_record, flush=True)
        panic_path=temp/'PANIC.X';panic_path.write_bytes(panic)
        out=temp/('pwp_native.dll' if os.name=='nt' else
                  'pwp_native.dylib' if sys.platform=='darwin' else 'pwp_native.so')
        flags=['-O2','-std=gnu11']
        if os.name!='nt': flags+=['-fPIC']
        # Tab5's m68kconf.h already fixes the 68000 configuration. Avoid
        # -D overrides that generated five 'macro redefined' warnings.
        # SoftFloat's milieu.h directly includes mamesf.h.
        flags+=['-I',snap,'-I',snap/'softfloat',
                '-DPWP_TAB5_MUSASHI=1',
                '-Werror=implicit-function-declaration']
        flags+=['-dynamiclib'] if sys.platform=='darwin' else ['-shared']
        flags += [ROOT/'core'/'pwp_musashi.c', ROOT/'core'/'pwp_x68k_video_bus.c',
                  ROOT/'core'/'pwp_x68k_frame.c', snap/'m68kcpu.c', snap/'m68kops.c',
                  snap/'softfloat'/'softfloat.c','-lm','-o',out]
        invoke([cc,*flags])
        if not out.is_file(): raise RuntimeError('Native Musashi library missing after compilation')
        runner=ROOT/'tools'/'RUN_R13_NATIVE_CPU.py'
        proof=temp/'real_cpu.json'
        invoke([sys.executable,runner,out,panic_path,'--evidence',proof])
        if not proof.exists(): raise RuntimeError('Real native CPU evidence missing')
        result=json.loads(proof.read_text(encoding='utf-8'))
        validate_real_native_proof(result)
        io_evidence=temp/'real_guest_io.json'
        invoke([sys.executable,ROOT/'tools'/'RUN_R14_NATIVE_GUEST_IO.py',out,
                '--evidence',io_evidence])
        if not io_evidence.is_file():
            raise RuntimeError('Real CPU file I/O evidence missing')
        io_result=json.loads(io_evidence.read_text(encoding='utf-8'))
        if io_result.get('result')!='REAL_NATIVE_MUSASHI_GUEST_IO_PASS':
            raise RuntimeError('Real CPU file I/O incomplete')
        result['guest_io_evidence']=io_result
        result['source_file_sha256']=sums
        result['host_compiler']=str(cc)
        result['native_binary_sha256']=hashlib.sha256(out.read_bytes()).hexdigest()
        evidence.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('PASS native Musashi+PANIC.X startup + guest OPEN/READ/SEEK/CLOSE. WASM and playback remain UNVERIFIED.')

if __name__=='__main__':
    try:
        main()
    except (RuntimeError,FileNotFoundError,subprocess.CalledProcessError,OSError,ValueError) as e:
        raise SystemExit(f'SAFE STOP R13 real native CPU: {e}')
