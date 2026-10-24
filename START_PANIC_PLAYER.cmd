@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ROOT=%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo ERROR: py launcher is missing
  pause
  exit /b 2
)
set "PAN=G:\panicplayer\PELSIA01.PAN"
rem Optional: drag any owned PAN onto this .cmd, or choose it in the browser.
if not "%~1"=="" set "PAN=%~1"
py -3 "%ROOT%tools\START_PLAY.py" --source "G:\X68KTab5" --pan "%PAN%"
set "RC=%errorlevel%"
if not "%RC%"=="0" (
 echo.
 echo FIX37 stopped. No existing sources were modified.
 pause
)
exit /b %RC%
