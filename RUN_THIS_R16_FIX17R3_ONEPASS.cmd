@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ROOT=%~dp0"
set "PANFILE=%~1"
if not defined PANFILE set "PANFILE=G:\panicplayer\PELSIA01.PAN"
if not exist "%ROOT%tools\RUN_R16_ONEPASS.py" (echo SAFE STOP: R16 FIX17R3 source missing & exit /b 2)
if not exist "G:\X68KTab5\components\px68k\m68000\musashi\m68kcpu.c" (echo SAFE STOP: original X68KTab5 source missing & exit /b 2)
if not exist "%PANFILE%" (echo SAFE STOP: PAN file absent: "%PANFILE%" & exit /b 2)
where py >nul 2>nul
if errorlevel 1 (echo SAFE STOP: Python launcher unavailable & exit /b 2)
echo =============================================================
echo PWP R16 FIX17R3 - REAL Musashi native/WASM + PANIC.X original guest framebuffer PNG evidence + verified PAN transfer
 echo SOURCE: G:\X68KTab5 [READ ONLY]
echo PAN: "%PANFILE%" [READ ONLY]
echo Target: G:\PWP_R16_FIX17R3_SEND_THIS.zip
 echo NO FLASH / NO SDK INSTALL / NO PRODUCTION MODIFICATION
 echo =============================================================
py -3 "%ROOT%tools\RUN_R16_ONEPASS.py" --source "G:/X68KTab5" --report-dir "G:/" --pan "%PANFILE%"
exit /b %errorlevel%
