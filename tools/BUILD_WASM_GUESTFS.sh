#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
: "${CLANG:=clang}"
"$CLANG" --target=wasm32 -std=c11 -O2 -Wall -Wextra -Werror \
  -nostdlib -Wl,--no-entry -Wl,--export=pwp_mount -Wl,--export=pwp_unmount \
  -Wl,--export=pwp_seek -Wl,--export=pwp_read -Wl,--export=pwp_size \
  -Wl,--export=pwp_tell -Wl,--export=pwp_is_mounted \
  -Wl,--export-memory -Wl,--initial-memory=131072 -Wl,--max-memory=2097152 \
  -o "$ROOT/core/pwp_guestfs.wasm" "$ROOT/core/pwp_guestfs.c"
echo "PASS: compiled portable guestfs.wasm (not full PANIC emulator)"
