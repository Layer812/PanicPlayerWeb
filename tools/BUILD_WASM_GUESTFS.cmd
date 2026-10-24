@echo off
setlocal
cd /d "%~dp0\.."
where clang >nul 2>nul
if errorlevel 1 (
  echo CLANG NOT FOUND - install a clang/wasm-ld toolchain
  exit /b 1
)
call clang --target=wasm32 -std=c11 -O2 -Wall -Wextra -Werror -nostdlib -Wl,--no-entry -Wl,--export=pwp_mount -Wl,--export=pwp_unmount -Wl,--export=pwp_seek -Wl,--export=pwp_read -Wl,--export=pwp_size -Wl,--export=pwp_tell -Wl,--export=pwp_is_mounted -Wl,--export-memory -Wl,--initial-memory=131072 -Wl,--max-memory=2097152 -o core/pwp_guestfs.wasm core/pwp_guestfs.c
if errorlevel 1 exit /b 1
echo PASS: portable guestfs WASM compiled (NOT PANIC playback)
