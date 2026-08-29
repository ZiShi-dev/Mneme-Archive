@echo off
setlocal
echo.
echo Fermeture de CinéVault...
taskkill /F /IM CineVault.exe /T >nul 2>&1
powershell.exe -NoProfile -Command "Get-Process CineVault -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1
if errorlevel 1 (
  echo Aucune instance active trouvee.
) else (
  echo CinéVault a ete ferme.
)
echo.
pause
