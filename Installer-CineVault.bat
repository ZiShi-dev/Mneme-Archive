@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================
echo   Installation de CineVault
echo ========================================
echo.
echo N'utilisez PAS release\setup-0.1.0.exe (bug NSIS).
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-cinevault.ps1"
pause
