@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Nettoyage des anciennes builds CineVault ===
echo.

echo 1. Fermeture de CineVault...
taskkill /F /IM CineVault.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 2. Suppression des dossiers de build Windows...
for %%D in (release electron-dist release-new) do (
  if exist "%~dp0%%D" (
    rmdir /S /Q "%~dp0%%D" 2>nul
    if exist "%~dp0%%D" (
      echo ERREUR: impossible de supprimer %%D\
      echo Fermez CineVault et l'installateur, puis relancez.
      pause
      exit /b 1
    )
    echo Supprime: %%D\
  )
)

echo.
echo Termine. Regenerez avec: npm run build:win
echo.
pause
