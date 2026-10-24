#!/usr/bin/env python3
"""Extract the exact original PANIC.X bytes from the user's own X68KTab5 source.

This utility does not fetch anything and never changes original source. Supply
src/panic_x_bin.c from the verified Layer812/X68KTab5 tree, not arbitrary input.
"""
import argparse
import hashlib
import re
from pathlib import Path

KNOWN_SIZE = 15412  # public X68KTab5 / src/panic_x_bin.c (2026-10-23)


def extract(source: str) -> bytes:
    match = re.search(r'const\s+uint8_t\s+panic_x_bin\s*\[\s*\]\s*=\s*\{(.*?)\}\s*;', source, re.S)
    if match is None:
        raise ValueError('panic_x_bin array not found')
    block = match.group(1)
    # Accept only comma-separated literal C hex byte tokens. Reject extras.
    tokens = [x.strip() for x in block.split(',') if x.strip()]
    if any(re.fullmatch(r'0[xX][0-9a-fA-F]{1,2}', t) is None for t in tokens):
        raise ValueError('non-literal byte inside panic_x_bin')
    payload = bytes(int(t, 16) for t in tokens)
    match_len = re.search(r'const\s+size_t\s+panic_x_bin_len\s*=\s*(\d+)\s*[uU]?\s*;', source)
    if match_len is None or int(match_len.group(1)) != len(payload):
        raise ValueError('declared payload length mismatch')
    if len(payload) != KNOWN_SIZE or payload[:2] != b'HU':
        raise ValueError('unexpected PANIC.X size or HU executable header')
    return payload


def main():
    p = argparse.ArgumentParser(description='Extract original PANIC.X from a local X68KTab5 source')
    p.add_argument('source', type=Path, help='path to X68KTab5/src/panic_x_bin.c')
    p.add_argument('destination', type=Path, help='new target PANIC.X file (must not exist)')
    args = p.parse_args()
    data = extract(args.source.read_text(encoding='utf-8'))
    # Exclusive-create; keep the original repository/any older outputs unchanged.
    with args.destination.open('xb') as fp:
        fp.write(data)
    print('PASS: verified exact PANIC.X: bytes=', len(data), 'sha256=', hashlib.sha256(data).hexdigest())
    print('Output:', args.destination)


if __name__ == '__main__':
    main()
