#!/usr/bin/env python3
"""PWP R15 FIX8: isolate verified emsdk environment from broken CMD label calls.

Read-only X68KTab5 source; genuine native+WASM acceptance; one atomic report.
No emsdk download/install, no flash, no changes to original project launchers.
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
import time
import zipfile

PROJECT_FILES = (
    'tools/BUILD_R13_HOST_CPU.py', 'tools/BUILD_R12_ACTUAL.py',
    'tools/RUN_R9_PANIC_BOOT.mjs', 'tools/RUN_R9_CPU_SMOKE.mjs',
    'tools/RUN_R14_WASM_GUEST_IO.mjs', 'core/pwp_musashi.c'
)
READ_ONLY_FILES = (
    'components/px68k/m68000/musashi/m68kcpu.c',
    'components/px68k/m68000/musashi/m68kops.c',
    'components/px68k/m68000/musashi/m68k.h',
    'src/panic_x_bin.c',
)
FIX6_BOOT_SHA256 = '446c0f9b68b8461e3158a5779aedbbf3c9b00bbf113c4a400b77aeccc4e34e06'
VERIFIED_REAL_CPU_FILES = {
    'tools/BUILD_R13_HOST_CPU.py': '829e630e5f588f16c134c77b88124e04618e93bdbe69b34a4f46c14802e3e95b',
    'tools/BUILD_R12_ACTUAL.py': 'b4a791a632713e5d685f59be996b7c0c6913401ac5cb1773b6b5bd42aacab1b4',
    'tools/RUN_R13_NATIVE_CPU.py': 'b4404f076c89ef96ea9e2d15b20872133e81a025afba032a165e87ed57e1b871',
    'core/pwp_musashi.c': 'd2c9058dbaca01ac0f8397db08ff1589f8b0fdea193ee20d34664865747298be',
}
PANIC_X_SHA256 = 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for part in iter(lambda: f.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def source_hashes(source):
    return {p: sha(source / p) if (source / p).is_file() else None for p in READ_ONLY_FILES}


def validate_project(project):
    for rel in PROJECT_FILES:
        if not (project / rel).is_file():
            raise RuntimeError('Required original source missing (not modified): ' + rel)
    got = sha(project / 'tools/RUN_R9_PANIC_BOOT.mjs')
    if got != FIX6_BOOT_SHA256:
        raise RuntimeError('FIX6 real PANIC.X boot script SHA-256 does not match; refusing stale or unknown code: ' + got)
    # Proven real CPU build scripts from the user's FIX3 success (6/7 reports).
    # A mock/stale replacement cannot manufacture a real CPU gate PASS.
    for rel, expected in VERIFIED_REAL_CPU_FILES.items():
        f = project/rel
        if not f.is_file() or sha(f) != expected:
            raise RuntimeError('Authentic FIX3 real-Musashi gate mismatch (no edits made): ' + rel)


def emcc_probe(env, seconds=35):
    compiler = shutil.which('emcc', path=env.get('PATH', ''))
    # Some non-shell hosts do not enumerate .BAT via which(), even though
    # Windows cmd.exe executes it correctly by fully qualified path.
    if not compiler and env.get('PWP_FIX8_EMCC'):
        found = Path(env['PWP_FIX8_EMCC'])
        compiler = str(found) if found.is_file() else None
    if not compiler:
        return None, 'emcc not on this environment PATH'
    try:
        p = subprocess.run([compiler, '--version'], env=env, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, errors='replace', timeout=seconds)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, 'emcc --version did not run: ' + str(e)
    if p.returncode != 0:
        return None, 'emcc --version rc=' + str(p.returncode) + ' ' + p.stdout[:500].strip()
    return str(compiler), (p.stdout.splitlines() or ['emcc OK'])[0][:220]


def bat_environment(bat, base):
    """Read SDK environment in an isolated CMD process; no label/subroutine calls.

    Only returned environment is passed to the WASM child. Never echo the whole
    environment to logs (it can contain private values).
    """
    if os.name != 'nt':
        raise RuntimeError('emsdk_env.bat is Windows-only')
    if '"' in str(bat) or '%' in str(bat):
        raise RuntimeError('Unsupported quoting in local SDK path')
    marker = '__PWP_FIX8_ENV_START__'
    command = f'call "{bat}" >nul 2>nul && echo {marker} && set'
    p = subprocess.run(command, shell=True, cwd=bat.parent,
                       env=base, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       encoding='mbcs', errors='replace', timeout=80)
    if p.returncode or marker not in p.stdout:
        raise RuntimeError(f'emsdk_env.bat returned {p.returncode}: {p.stderr[:250]}')
    values = dict(base)
    lines = p.stdout.split(marker, 1)[1].splitlines()
    updated = 0
    for line in lines:
        if '=' in line and not line.startswith('='):
            key, value = line.split('=', 1)
            if key and '\x00' not in key:
                values[key] = value
                updated += 1
    if updated < 4:
        raise RuntimeError('Unusable SDK environment capture')
    return values


def fallback_environment(sdk, base):
    """Installed SDK only: resolve compiler directly when bat cannot be used."""
    env = dict(base)
    compiler = sdk / 'upstream' / 'emscripten' / ('emcc.bat' if os.name == 'nt' else 'emcc')
    if not compiler.is_file():
        return None
    env['EMSDK'] = str(sdk)
    env['PWP_FIX8_EMCC'] = str(compiler)
    paths = [str(sdk / 'upstream' / 'emscripten'), str(sdk)]
    for folder in ('node', 'python'):
        root = sdk / folder
        if root.is_dir():
            # Only installed tool dirs, never overwrites other SDK projects.
            paths.extend(str(x) for x in sorted(root.iterdir(), reverse=True) if x.is_dir() and (x / ('node.exe' if folder == 'node' else 'python.exe')).exists())
    env['PATH'] = os.pathsep.join(paths) + os.pathsep + env.get('PATH', '')
    cfg = sdk / '.emscripten'
    if cfg.is_file():
        env['EM_CONFIG'] = str(cfg)
    return env


def resolve_compiler(project, log):
    base = dict(os.environ)
    candidates = []
    # Prefer the SDK already installed by FIX5. Do not reinstall it.
    for candidate in (project / 'vendor/emsdk', project.parent / 'PanicPlayerWeb_R15' / 'vendor' / 'emsdk',
                      Path(os.environ['PWP_EMSDK_DIR']) if os.environ.get('PWP_EMSDK_DIR') else None,
                      Path('G:/emsdk'), Path('G:/tools/emsdk'), Path('C:/emsdk'),
                      Path.home() / 'emsdk'):
        if candidate is not None and candidate not in candidates:
            candidates.append(candidate)
    compiler, version = emcc_probe(base)
    if compiler:
        log.append('PASS pre-existing PATH emcc: ' + compiler)
        log.append('VERSION: ' + version)
        return base, compiler
    log.append('Existing process PATH has no working emcc; checking only installed SDKs.')
    for sdk in candidates:
        bat = sdk / 'emsdk_env.bat'
        if not bat.is_file():
            continue
        log.append('SDK candidate: ' + str(sdk))
        try:
            env = bat_environment(bat, base)
            compiler, version = emcc_probe(env)
            if compiler:
                log.append('PASS isolated emsdk_env.bat; compiler: ' + compiler)
                log.append('VERSION: ' + version)
                env['EMCC'] = compiler
                return env, compiler
            log.append('SDK environment did not provide a working compiler: ' + version)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as e:
            log.append('Isolated SDK environment capture failed: ' + str(e))
        env = fallback_environment(sdk, base)
        if env is not None:
            compiler, version = emcc_probe(env)
            if compiler:
                env['EMCC'] = compiler
                log.append('PASS existing SDK direct compiler fallback: ' + compiler)
                log.append('VERSION: ' + version)
                return env, compiler
            log.append('Direct existing SDK compiler fallback failed: ' + version)
    log.append('SAFE STOP: no existing working Emscripten. No SDK download or installation attempted.')
    return None, None


def run_gate(command, cwd, dest, label, env=None, timeout_seconds=1800, tick=10):
    start = time.monotonic()
    print(f'PWP [{label}] START (full output in report)', flush=True)
    with dest.open('w', encoding='utf-8', errors='replace') as fp:
        fp.write('COMMAND: ' + ' '.join(map(str, command)) + '\n\n')
        fp.flush()
        try:
            with subprocess.Popen([str(p) for p in command], cwd=cwd, env=env,
                                  stdout=fp, stderr=subprocess.STDOUT) as proc:
                while True:
                    try:
                        rc = proc.wait(timeout=tick)
                        break
                    except subprocess.TimeoutExpired:
                        elapsed = time.monotonic() - start
                        if elapsed >= timeout_seconds:
                            proc.kill()
                            proc.wait()
                            fp.write('\nSAFE STOP: stage timeout\n')
                            fp.flush()
                            print(f'PWP [{label}] STOP timeout {int(elapsed)}s', flush=True)
                            return 124
                        print(f'PWP [{label}] RUNNING {int(elapsed)}s; log {dest.stat().st_size} bytes', flush=True)
                fp.flush()
        except OSError as e:
            fp.write('SAFE STOP cannot launch: ' + str(e) + '\n')
            print(f'PWP [{label}] STOP launch error', flush=True)
            return 127
    print(f'PWP [{label}] ' + ('PASS' if rc == 0 else f'STOP rc={rc}') +
          f' ({int(time.monotonic() - start)}s)', flush=True)
    return rc


def manifest_ok(project, started_ns):
    result = project / 'R12_REAL_CPU_MANIFEST.json'
    wasm = project / 'core/pwp_musashi.wasm'
    mjs = project / 'core/pwp_musashi.mjs'
    if not all(p.is_file() and p.stat().st_mtime_ns >= started_ns for p in (result,wasm,mjs)):
        return False, 'Missing/fossil manifest or WASM outputs'
    try:
        info = json.loads(result.read_text(encoding='utf-8'))
    except (ValueError, OSError) as e:
        return False, 'Manifest parse: ' + str(e)
    if (info.get('status') != 'REAL_MUSASHI_PANIC_BOOT_PASS' or
        info.get('wasm_sha256') != sha(wasm) or
        wasm.read_bytes()[:4] != b'\0asm' or not mjs.stat().st_size):
        return False, 'Manifest/status/sha256/WASM magic validation failed'
    return True, 'real Musashi WASM + PANIC.X boot + guest I/O verified by R12 builder'


def write_zip_atomic(report, scratch):
    fd, temp = tempfile.mkstemp(prefix='.pwp_fix8_', suffix='.zip', dir=report.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for path in sorted(scratch.iterdir()):
                if path.is_file():
                    z.write(path, path.name)
        with zipfile.ZipFile(temp) as z:
            assert z.testzip() is None
        os.replace(temp, report)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def execute(project, source, output):
    if not output.is_dir():
        raise RuntimeError('Report directory unavailable: ' + str(output))
    report = output / 'PWP_R15_SEND_THIS.zip'
    begin = time.time_ns()
    with tempfile.TemporaryDirectory(prefix='pwp_fix8_') as td:
        scratch = Path(td)
        native_log = scratch/'native_musashi.log'
        wasm_log = scratch/'wasm_musashi.log'
        sdk_log = scratch/'sdk_preflight.log'
        summary = {'project': 'Panic Player Web R15', 'fix_revision':'PWP_R15_FIX8_ISOLATED_EMSDK',
                   'status':'SAFE_STOP', 'native_rc':None, 'wasm_rc':None,
                   'wasm_gate_manifest_verified':False,
                   'production_unchanged':None,
                   'pan_video_audio_playback_verified':False,
                   'report_prepared_independently': True,
                   'no_sdk_install':True,'no_flash':True}
        before = source_hashes(source)
        summary['source_sha256_before'] = before
        if any(v is None for v in before.values()):
            (scratch/'preflight.log').write_text('SAFE STOP required X68KTab5 source files missing.\n')
        try:
            validate_project(project)
            if any(v is None for v in before.values()):
                raise RuntimeError('Required X68KTab5 original source missing')
            sdk_lines = ['PWP FIX8 SDK env isolation; fixed SDK is reused, never reinstalled.']
            wasm_env, compiler = resolve_compiler(project, sdk_lines)
            sdk_log.write_text('\n'.join(sdk_lines)+'\n', encoding='utf-8')
            summary['emscripten_available'] = bool(compiler)
            summary['emcc_path'] = compiler or ''
            native = run_gate([sys.executable, project/'tools/BUILD_R13_HOST_CPU.py',
                               '--x68ktab-root',source], project, native_log,'NATIVE')
            summary['native_rc'] = native
            if native != 0:
                wasm_log.write_text('NOT RUN: actual native Musashi CPU acceptance failed.\n')
            elif not compiler:
                wasm_log.write_text('NOT RUN: Emscripten compiler could not be activated in an isolated environment.\n')
            else:
                wasm = run_gate([sys.executable, project/'tools/BUILD_R12_ACTUAL.py',
                                 '--x68ktab-root',source], project, wasm_log, 'WASM', env=wasm_env)
                summary['wasm_rc'] = wasm
                if wasm == 0:
                    valid, reason = manifest_ok(project, begin)
                    summary['wasm_gate_manifest_verified'] = valid
                    summary['manifest_validation'] = reason
            after = source_hashes(source)
            summary['source_sha256_after'] = after
            summary['production_unchanged'] = (before == after)
            if native == 0 and summary['wasm_rc'] == 0 and summary['wasm_gate_manifest_verified'] and before == after:
                summary['status'] = 'PASS_REAL_NATIVE_AND_WASM_CPU_PANIC_BOOT_AND_IO_NOT_PLAYBACK'
        except (RuntimeError, ValueError, FileNotFoundError, OSError, subprocess.TimeoutExpired) as e:
            summary['stop_reason'] = str(e)
            if not sdk_log.exists():
                sdk_log.write_text('SDK preflight was not reached: '+str(e)+'\n')
            if not native_log.exists():
                native_log.write_text('NOT RUN: '+str(e)+'\n')
            if not wasm_log.exists():
                wasm_log.write_text('NOT RUN: '+str(e)+'\n')
        finally:
            if summary.get('production_unchanged') is None:
                after = source_hashes(source)
                summary['source_sha256_after'] = after
                summary['production_unchanged'] = (before == after)
            (scratch/'SUMMARY.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
            for evidence in ('R13_REAL_HOST_CPU_EVIDENCE.json', 'R12_REAL_CPU_MANIFEST.json'):
                path=project/evidence
                if path.is_file() and path.stat().st_mtime_ns >= begin:
                    shutil.copyfile(path, scratch/evidence)
            write_zip_atomic(report, scratch)
        print('PWP FIX8 STATUS:', summary['status'], flush=True)
        print('PWP FIX8 REPORT:', report, flush=True)
        print('PWP FIX8 Production source unchanged:', summary['production_unchanged'], flush=True)
        return 0 if summary['status'].startswith('PASS_') else 3


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--project',default='G:/PanicPlayerWeb_R15')
    ap.add_argument('--x68ktab-root',default='G:/X68KTab5')
    ap.add_argument('--report-dir',default='G:/')
    a=ap.parse_args()
    return execute(Path(a.project).resolve(), Path(a.x68ktab_root).resolve(), Path(a.report_dir).resolve())


if __name__ == '__main__':
    sys.exit(main())
