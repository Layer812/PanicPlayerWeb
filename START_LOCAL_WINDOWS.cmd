@echo off
setlocal
cd /d "%~dp0" || exit /b 1
where py >nul 2>nul
if not errorlevel 1 (
    echo Starting PANIC PLAYER WEB R5 at http://localhost:8765/
    start "" "http://localhost:8765/"
    py -3 -m http.server 8765
) else (
    where python >nul 2>nul || (echo Python 3 is required & exit /b 1)
    echo Starting PANIC PLAYER WEB R5 at http://localhost:8765/
    start "" "http://localhost:8765/"
    python -m http.server 8765
)
endlocal
