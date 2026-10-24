#!/usr/bin/env python3
"""Restore the standard Musashi non-ESP opcode fetch in an ISOLATED copy only.

X68KTab5's ESP_PLATFORM branch has its own fetch implementation. The
non-ESP branch lost REG_IR = m68ki_read_imm_16() while ESP code evolved.
The canonical Musashi m68kcpu.c executes that fetch before dispatch.

All edits are constrained to the temporary private source copy created by
BUILD_R13_HOST_CPU / BUILD_R12_ACTUAL. Never modify the X68KTab5 checkout.
"""
from __future__ import annotations
import hashlib
from pathlib import Path

ORIGINAL_SHA256 = 'a08ffa3560fd6595fa1bd853860e4a4042d55d9862707da5e4cf97515b54e644'
OLD = (b'#else\n\t\t\tm68ki_instruction_jump_table[REG_IR]();\n'
       b'\t\t\tUSE_CYCLES(CYC_INSTRUCTION[REG_IR]);\n#endif')
NEW = (b'#else\n'
       b'\t\t\t/* Web port: restore stock Musashi opcode fetch on non-ESP hosts. */\n'
       b'\t\t\tREG_IR = m68ki_read_imm_16();\n'
       b'\t\t\tm68ki_instruction_jump_table[REG_IR]();\n'
       b'\t\t\tUSE_CYCLES(CYC_INSTRUCTION[REG_IR]);\n#endif')

def patch_private_copy(path: Path) -> dict:
    path = Path(path)
    contents = path.read_bytes()
    original = hashlib.sha256(contents).hexdigest()
    if original != ORIGINAL_SHA256:
        raise RuntimeError(f'Unknown Tab5 Musashi m68kcpu.c revision: {original}; not patched')
    if contents.count(OLD) != 1 or NEW in contents:
        raise RuntimeError('Expected non-ESP opcode dispatch site missing/ambiguous; not patched')
    new = contents.replace(OLD, NEW, 1)
    if new.count(b'REG_IR = m68ki_read_imm_16();') != 1:
        raise RuntimeError('Unexpected opcode-fetch layout; not patched')
    path.write_bytes(new)
    if path.read_bytes() != new:
        raise RuntimeError('Isolated copy write/verify failed')
    return {'original_sha256': original, 'isolated_patched_sha256': hashlib.sha256(new).hexdigest()}
