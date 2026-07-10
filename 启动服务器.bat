@echo off
setlocal
chcp 65001 >nul
title SSA Dev Server - port 8080
cd /d "%~dp0"

set "PORT=8080"
set "PC_URL=http://localhost:%PORT%"
set "EDITOR_URL=%PC_URL%/?editor=1"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ips = @(Get-NetIPConfiguration | Where-Object { $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway } | ForEach-Object { $_.IPv4Address[0].IPAddress }); if (-not $ips) { $ips = @([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not $_.IPAddressToString.StartsWith('127.') -and -not $_.IPAddressToString.StartsWith('169.254.') } | ForEach-Object { $_.IPAddressToString }) }; $ip = $ips | Where-Object { $_ -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' } | Select-Object -First 1; if (-not $ip) { $ip = $ips | Select-Object -First 1 }; if ($ip) { $ip } else { 'localhost' }"`) do set "LAN_IP=%%I"
if not defined LAN_IP set "LAN_IP=localhost"
set "MOBILE_URL=http://%LAN_IP%:%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js was not found. Please install Node.js first.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] npm was not found. Please reinstall Node.js with npm enabled.
  echo.
  pause
  exit /b 1
)

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo ==============================================
  echo    SSA Dev Server 已经在运行
  echo.
  echo    手机访问: %MOBILE_URL%
  echo    电脑编辑: %EDITOR_URL%
  echo ==============================================
  echo.
  pause
  exit /b 0
)

echo ==============================================
echo    SSA Dev Server
echo.
echo    手机访问: %MOBILE_URL%
echo    电脑编辑: %EDITOR_URL%
echo.
echo    关闭此窗口或按 Ctrl+C 停止服务器。
echo ==============================================
echo.

set "PORT=%PORT%"
call npm start

echo.
echo 服务器已停止。如果上方出现错误，请发送截图。
pause
