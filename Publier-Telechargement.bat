@echo off
setlocal
cd /d "%~dp0"
echo.
echo Publication sur GitHub (telechargement public)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publier-telechargement-github.ps1"
pause
