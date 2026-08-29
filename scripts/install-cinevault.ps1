$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "release\win-unpacked"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\CineVault"
$exe = Join-Path $installDir "CineVault.exe"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$desktopLink = if ($desktopDir) { Join-Path $desktopDir "CineVault.lnk" } else { $null }
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$startMenuLink = Join-Path $startMenuDir "CineVault.lnk"

if (-not (Test-Path (Join-Path $source "CineVault.exe"))) {
  Write-Host ""
  Write-Host "ERREUR: build introuvable. Lancez d'abord: npm run build:win" -ForegroundColor Red
  Write-Host "Ou utilisez release\CineVault-Portable-0.1.0.exe sans installation." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "Appuyez sur Entree pour fermer"
  exit 1
}

function Remove-InstallDir([string]$path) {
  if (-not (Test-Path $path)) { return }
  $emptyDir = Join-Path $env:TEMP ("cinevault-empty-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
  robocopy $emptyDir $path /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  Remove-Item $emptyDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Installation de CinéVault..." -ForegroundColor Cyan

Get-Process CineVault -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Remove-InstallDir $installDir

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
robocopy $source $installDir /E /COPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "La copie des fichiers a echoue (code $LASTEXITCODE)."
}

$shell = New-Object -ComObject WScript.Shell

if ($desktopLink) {
  if (-not (Test-Path $desktopDir)) {
    New-Item -ItemType Directory -Path $desktopDir -Force | Out-Null
  }
  $desktop = $shell.CreateShortcut($desktopLink)
  $desktop.TargetPath = $exe
  $desktop.WorkingDirectory = $installDir
  $desktop.Description = "CinéVault"
  $desktop.Save()
}

if (-not (Test-Path $startMenuDir)) {
  New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}

$startMenu = $shell.CreateShortcut($startMenuLink)
$startMenu.TargetPath = $exe
$startMenu.WorkingDirectory = $installDir
$startMenu.Description = "CinéVault"
$startMenu.Save()

Write-Host ""
Write-Host "Installation terminee." -ForegroundColor Green
Write-Host "  Dossier : $installDir"
if ($desktopLink) {
  Write-Host "  Bureau  : $desktopLink"
}
Write-Host ""

$launch = Read-Host "Lancer CinéVault maintenant ? (O/n)"
if ($launch -ne "n" -and $launch -ne "N") {
  Start-Process $exe
}
