#!/usr/bin/env python3
"""Exercise genuine Musashi through the normal standalone adapter, via ctypes.

No mocks in this runner. An injected mock cannot pass the instruction checks.
The native pointer accessor is specifically for 64-bit hosts, not the WASM ABI.
"""
from __future__ import annotations
import argparse
import ctypes
import hashlib
import json
from pathlib import Path
import sys

EXPECTED_SHA256 = 'f26527c3d19e71b41fb24efbfff03ae862c8e2430c0e3dc84e7ca67047b1f2fd'
COMMAND = b'C:\\P68K.PAN'


def synthetic_hu() -> bytes:
    # MOVEQ #42,D0; ADDQ.L #1,D0; NOP; DOS _MALLOC; DOS _EXIT2
    code = bytes.fromhex('70 2a 52 80 4e 71 ff 48 ff 4c')
    h = bytearray(64 + len(code))
    h[:2] = b'HU'
    h[12:16] = len(code).to_bytes(4, 'big')
    h[64:] = code
    return bytes(h)


def open_lib(path: Path):
    dll = ctypes.CDLL(str(path.resolve()))
    signatures = {
        'pwp_mu_stage_native_ptr': (ctypes.c_void_p, []),
        'pwp_mu_stage_capacity': (ctypes.c_uint32, []),
        'pwp_mu_load': (ctypes.c_int32, [ctypes.c_uint32]),
        'pwp_mu_run': (ctypes.c_int32, [ctypes.c_uint32]),
        'pwp_mu_dispatch': (ctypes.c_int32, []),
        'pwp_mu_register': (ctypes.c_uint32, [ctypes.c_uint32]),
        'pwp_mu_pc': (ctypes.c_uint32, []),
        'pwp_mu_trap': (ctypes.c_uint32, []),
        'pwp_mu_trap_pc': (ctypes.c_uint32, []),
        'pwp_mu_steps': (ctypes.c_uint32, []),
        'pwp_mu_exit_code': (ctypes.c_uint32, []),
        'pwp_mu_guest_peek8': (ctypes.c_uint32, [ctypes.c_uint32]),
        'pwp_mu_guest_peek32': (ctypes.c_uint32, [ctypes.c_uint32]),
        'pwp_mu_bss_end': (ctypes.c_uint32, []),
    }
    for name, (restype, argtypes) in signatures.items():
        f = getattr(dll, name)
        f.restype, f.argtypes = restype, argtypes
    return dll


def check(ok, what):
    if not ok:
        raise RuntimeError(f'REAL CPU TEST FAIL: {what}')


def stage(dll, data):
    check(0 < len(data) <= dll.pwp_mu_stage_capacity(), 'HU staging capacity')
    dst = dll.pwp_mu_stage_native_ptr()
    check(dst and dst > 4096, 'nontruncated 64-bit native pointer')
    ctypes.memmove(dst, data, len(data))
    check(dll.pwp_mu_load(len(data)) == 1, 'HU load')
    return dst


def run(dll, original: bytes):
    stage(dll, synthetic_hu())
    check(dll.pwp_mu_pc() == 0x10000, 'synthetic entrypoint')
    check(dll.pwp_mu_run(32) == 2, 'synthetic first trap reached')
    check(dll.pwp_mu_trap() == 0xff48, 'synthetic _MALLOC')
    check(dll.pwp_mu_register(0) == 43,
          f'real 68000 MOVEQ+ADDQ result: D0={dll.pwp_mu_register(0):#010x} PC={dll.pwp_mu_pc():#010x} steps={dll.pwp_mu_steps()} trap={dll.pwp_mu_trap():#06x}')
    check(dll.pwp_mu_steps() == 3, 'synthetic 3 real instructions')
    check(dll.pwp_mu_dispatch() == 1, '_MALLOC dispatch')
    check(ctypes.c_int32(dll.pwp_mu_register(0)).value == -8, '_MALLOC(0) rejects request')
    check(dll.pwp_mu_run(32) == 2 and dll.pwp_mu_trap() == 0xff4c, '_EXIT2 trap')
    check(dll.pwp_mu_dispatch() == 4, '_EXIT2 termination')
    check(dll.pwp_mu_exit_code() == 0, '_EXIT2 exit code')

    check(hashlib.sha256(original).hexdigest() == EXPECTED_SHA256,
          'original PANIC.X SHA256')
    stage(dll, original)
    a2 = dll.pwp_mu_register(10)
    check(a2 == 0x8000, 'Human68k startup A2 address')
    check(dll.pwp_mu_guest_peek8(a2) == len(COMMAND), 'LASCII command length')
    for i, c in enumerate(COMMAND):
        check(dll.pwp_mu_guest_peek8(a2+1+i) == c, f'LASCII command char {i}')
    check(dll.pwp_mu_guest_peek8(a2+1+len(COMMAND)) == 0,
          'LASCII terminating NUL')
    program_end=dll.pwp_mu_bss_end()
    check(program_end==0x15366, 'genuine PANIC.X program+BSS end')
    check(dll.pwp_mu_register(9)==program_end, 'Human68k A1 is end of program, not initial allocation')
    check(dll.pwp_mu_guest_peek32(0xfff8)==0x3f0000, 'initial MCB holds full allocation')
    check(dll.pwp_mu_run(24) == 2, 'PANIC.X first trap')
    check(dll.pwp_mu_trap() == 0xff4a, 'PANIC.X initial _SETBLOCK')
    check(dll.pwp_mu_trap_pc() == 0x10012, 'PANIC.X expected FF4A PC')
    check(dll.pwp_mu_steps() == 6, 'PANIC.X genuine first 6 instructions')
    check(dll.pwp_mu_dispatch() == 1, 'PANIC.X _SETBLOCK returns')
    check(dll.pwp_mu_register(0) == 0, 'PANIC.X _SETBLOCK D0 zero')
    check(dll.pwp_mu_guest_peek32(0xfff8)==program_end,'_SETBLOCK must free unused memory')
    check(dll.pwp_mu_run(100)==2,'genuine PANIC.X next DOS trap')
    check(dll.pwp_mu_trap()==0xff48 and dll.pwp_mu_trap_pc()==0x10020,
          'genuine PANIC.X reaches 256KiB _MALLOC')
    check(dll.pwp_mu_dispatch()==1,'_MALLOC 256KiB dispatch')
    workspace=ctypes.c_int32(dll.pwp_mu_register(0)).value
    check(program_end<=workspace<0x3f0000-0x40000,
          f'genuine PANIC.X workspace allocation failed: {workspace}')
    return {'result': 'REAL_NATIVE_MUSASHI_SYNTHETIC_AND_PANIC_MALLOC_PASS',
            'cpu': 'actual Musashi compiled into native shared library',
            'synthetic': 'MOVEQ ADDQ NOP _MALLOC _EXIT2',
            'panic_sha256': EXPECTED_SHA256,
            'panic': {'instructions_executed': 6, 'first_dos': 'FF4A', 'trap_pc': '0x10012',
                      'commandline': COMMAND.decode('ascii'), 'setblock_d0': 0,
                      'program_end':program_end,'malloc_d0':workspace,'startup_workspace_bytes':0x40000},
            'limitations': ['no WASM built by native probe', 'no PAN video playback',
                            'no YM2151/ADPCM', 'no complete Human68k or IOCS']}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('library', type=Path)
    p.add_argument('panic_x', type=Path)
    p.add_argument('--evidence', type=Path)
    a = p.parse_args()
    # Remove any stale success evidence first. Never carry an old PASS forward.
    if a.evidence and a.evidence.exists():
        a.evidence.unlink()
    dll = open_lib(a.library)
    actual = a.panic_x.read_bytes()
    output = run(dll, actual)
    if a.evidence:
        a.evidence.write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(output, indent=2))
    print('PASS R13 ACTUAL NATIVE MUSASHI. NOT PAN PLAYBACK.')


if __name__ == '__main__':
    try:
        main()
    except Exception as ex:
        print(f'SAFE STOP R13 REAL CPU: {ex}', file=sys.stderr)
        sys.exit(1)
