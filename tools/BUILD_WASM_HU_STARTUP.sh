#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
: "${CLANG:=clang}"
"$CLANG" --target=wasm32 -std=c11 -O2 -Wall -Wextra -Werror \
  -nostdlib -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=8388608 \
  -Wl,--max-memory=8388608 -Wl,--stack-first -Wl,-z,stack-size=524288 \
  -Wl,--export=pwp_hu_stage_ptr -Wl,--export=pwp_hu_stage_capacity \
  -Wl,--export=pwp_hu_load -Wl,--export=pwp_hu_reset \
  -Wl,--export=pwp_hu_step -Wl,--export=pwp_hu_run \
  -Wl,--export=pwp_hu_register -Wl,--export=pwp_hu_pc \
  -Wl,--export=pwp_hu_steps -Wl,--export=pwp_hu_status \
  -Wl,--export=pwp_hu_image_end -Wl,--export=pwp_hu_bss_end \
  -Wl,--export=pwp_hu_trap_opcode -Wl,--export=pwp_hu_fault_pc \
  -Wl,--export=pwp_hu_fault_opcode -Wl,--export=pwp_hu_guest_peek32 \
  -o "$ROOT/core/pwp_hu_boot.wasm" "$ROOT/core/pwp_hu_boot.c"
echo 'PASS: R3 bounded HU startup executor wasm built (not full Musashi)' 
