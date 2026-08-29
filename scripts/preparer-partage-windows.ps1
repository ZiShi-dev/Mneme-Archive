$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$version = "0.1.0"
$outDir = Join-Path (Join-Path $root "release") "CineVault-Partage-$version"
$portable = Join-Path (Join-Path $root "release") "CineVault-Portable-$version.exe"
$winUnpacked = Join-Path (Join-Path $root "release") "win-unpacked"
$installBundle = Join-Path $outDir "Installation"

if (-not (Test-Path $portable)) {
  throw "Build portable introuvable: $portable`nLancez: npm run build:win puis rebuild portable."
}
if (-not (Test-Path (Join-Path $winUnpacked "CineVault.exe"))) {
  throw "Build win-unpacked introuvable."
}

if (Test-Path $outDir) {
  Remove-Item -Recurse -Force $outDir
}
New-Item -ItemType Directory -Path $installBundle -Force | Out-Null

Copy-Item $portable (Join-Path $outDir "CineVault-Portable-$version.exe")
robocopy $winUnpacked (Join-Path $installBundle "app") /E /COPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Echec copie app (code $LASTEXITCODE)." }

Copy-Item (Join-Path $root "scripts\install-cinevault-standalone.ps1") (Join-Path $installBundle "install.ps1")

@'
@echo off
setlocal
cd /d "%~dp0"
echo.
echo Installation de CineVault...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
'@ | Set-Content -Path (Join-Path $installBundle "Installer-CineVault.bat") -Encoding ASCII

@'
CineVault - version portable / installation Windows
===============================================

OPTION 1 (recommandee) - Portable, 1 seul fichier
  Double-cliquez sur: CineVault-Portable-0.1.0.exe
  Aucune installation. Copiez ce fichier sur une cle USB ou envoyez-le.

OPTION 2 - Installation avec raccourci Bureau
  Ouvrez le dossier "Installation"
  Double-cliquez sur: Installer-CineVault.bat
  (Ne partagez pas le .bat seul: il faut tout le dossier Installation\)

IMPORTANT
  - Ne pas utiliser setup-0.1.0.exe (installateur NSIS bugue sur certains PC).
  - Windows peut afficher un avertissement "application inconnue": cliquez
    "Informations complementaires" puis "Executer quand meme".
'@ | Set-Content -Path (Join-Path $outDir "LISEZMOI.txt") -Encoding UTF8

$zip = Join-Path (Join-Path $root "release") "CineVault-Partage-$version.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path $outDir -DestinationPath $zip -Force

Write-Host ""
Write-Host "Paquet pret:" -ForegroundColor Green
Write-Host "  Dossier : $outDir"
Write-Host "  Zip     : $zip"
Write-Host ""
