@echo off
setlocal
chcp 65001 >nul
title Merge Tower Server - port 8080

cd /d "%~dp0"

echo Starting dist server...
echo http://localhost:8080
echo Press Ctrl+C to stop.
echo.

python -m http.server 8080 --directory "%~dp0dist"

echo.
echo Server stopped.
pause
