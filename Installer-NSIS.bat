@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================
echo   Installateur NSIS CineVault
echo ========================================
echo.
echo 1. Fermez toute fenetre "Installation de CineVault" ouverte.
echo 2. Lancez Fermer-CineVault.bat si l'app tourne encore.
echo.
set "SETUP=%~dp0release\setup-0.1.0.exe"
if not exist "%SETUP%" (
  echo Installateur introuvable. Lancez: npm run build:win
  pause
  exit /b 1
)
start "" /wait "%SETUP%"
