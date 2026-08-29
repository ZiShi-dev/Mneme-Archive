$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
foreach ($name in @("electron-dist", "release-new")) {
  $dir = Join-Path $root $name
  if (-not (Test-Path $dir)) { continue }
  $empty = Join-Path $env:TEMP ("empty-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $empty -Force | Out-Null
  robocopy $empty $dir /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  Remove-Item $empty -Recurse -Force
  Remove-Item $dir -Recurse -Force
  if (Test-Path $dir) {
    Write-Host "Impossible de supprimer: $dir (redemarrez ou fermez CineVault)"
  } else {
    Write-Host "Supprime: $dir"
  }
}
