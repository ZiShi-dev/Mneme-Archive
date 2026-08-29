$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$version = "0.1.0"
$tag = "cinevault-v$version"
$releaseDir = Join-Path (Join-Path $root "release") ""
$portable = Join-Path $releaseDir "CineVault-Portable-$version.exe"
$zip = Join-Path $releaseDir "CineVault-Partage-$version.zip"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) introuvable. Installez-le: https://cli.github.com/"
}

if (-not (Test-Path $portable)) {
  throw "Fichier manquant: $portable`nLancez d'abord Preparer-Partage.bat ou rebuild portable."
}

Write-Host ""
Write-Host "Publication telechargement CineVault $version" -ForegroundColor Cyan
Write-Host ""

$existing = gh release view $tag 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Release $tag existe deja. Mise a jour des fichiers..."
  gh release upload $tag $portable --clobber
  if (Test-Path $zip) {
    gh release upload $tag $zip --clobber
  }
} else {
  $notes = @"
CineVault $version — application Windows (films / series)

**Telechargement recommande**
- ``CineVault-Portable-$version.exe`` : double-clic, aucune installation

**Paquet complet (optionnel)**
- ``CineVault-Partage-$version.zip`` : portable + installateur avec raccourci Bureau

Windows peut afficher un avertissement securite (app non signee) : Informations complementaires > Executer quand meme.
"@
  $assets = @($portable)
  if (Test-Path $zip) { $assets += $zip }
  gh release create $tag $assets `
    --title "CineVault $version (Windows)" `
    --notes $notes
}

if ($LASTEXITCODE -ne 0) {
  throw "Echec publication GitHub Release."
}

$url = gh release view $tag --json url -q .url
Write-Host ""
Write-Host "Lien de telechargement public:" -ForegroundColor Green
Write-Host "  $url"
Write-Host ""
Write-Host "Partagez ce lien. Les utilisateurs cliquent sur CineVault-Portable-$version.exe."
Write-Host ""
