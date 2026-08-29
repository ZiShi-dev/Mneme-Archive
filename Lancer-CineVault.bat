@echo off
setlocal
cd /d "%~dp0"
taskkill /F /IM CineVault.exe >nul 2>&1
timeout /t 1 /nobreak >nul
set "APP=%~dp0release\win-unpacked\CineVault.exe"
if not exist "%APP%" (
  echo Build manquante. Lancez: npm run build:win
  pause
  exit /b 1
)
start "" "%APP%"
