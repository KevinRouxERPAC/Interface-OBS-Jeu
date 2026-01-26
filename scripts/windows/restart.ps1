# Quiz Overlay API - Redémarrage du serveur (PowerShell)

# Remonter à la racine du projet depuis scripts/windows/
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stopScript = Join-Path $PSScriptRoot "stop.ps1"
$startScript = Join-Path $PSScriptRoot "start.ps1"

Write-Host "🔄 Redémarrage du serveur..." -ForegroundColor Cyan
Write-Host ""

# Arrêter le serveur
if (Test-Path $stopScript) {
    & $stopScript
    Start-Sleep -Seconds 2
} else {
    Write-Host "[ERREUR] Script stop.ps1 non trouvé" -ForegroundColor Red
    exit 1
}

# Démarrer le serveur
if (Test-Path $startScript) {
    Write-Host ""
    Write-Host "▶️  Démarrage du serveur..." -ForegroundColor Green
    & $startScript $args
} else {
    Write-Host "[ERREUR] Script start.ps1 non trouvé" -ForegroundColor Red
    exit 1
}
