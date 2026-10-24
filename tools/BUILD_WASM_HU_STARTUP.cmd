@echo off
setlocal
cd /d "%~dp0.." || exit /b 1
where clang >nul 2>nul || (echo STOP: clang not found & exit /b 2)
clang --target=wasm32 -std=c11 -O2 -Wall -Wextra -Werror -nostdlib ^
  -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=8388608 ^
  -Wl,--max-memory=8388608 -Wl,--stack-first -Wl,-z,stack-size=524288 ^
  -Wl,--export=pwp_hu_stage_ptr -Wl,--export=pwp_hu_stage_capacity ^
  -Wl,--export=pwp_hu_load -Wl,--export=pwp_hu_reset ^
  -Wl,--export=pwp_hu_step -Wl,--export=pwp_hu_run ^
  -Wl,--export=pwp_hu_register -Wl,--export=pwp_hu_pc ^
  -Wl,--export=pwp_hu_steps -Wl,--export=pwp_hu_status ^
  -Wl,--export=pwp_hu_image_end -Wl,--export=pwp_hu_bss_end ^
  -Wl,--export=pwp_hu_trap_opcode -Wl,--export=pwp_hu_fault_pc ^
  -Wl,--export=pwp_hu_fault_opcode -Wl,--export=pwp_hu_guest_peek32 ^
  -o "core\pwp_hu_boot.wasm" "core\pwp_hu_boot.c"
if errorlevel 1 (echo STOP: wasm build failed & exit /b 1)
echo PASS: R3 bounded HU startup WASM built - playback NOT implemented
endlocal
