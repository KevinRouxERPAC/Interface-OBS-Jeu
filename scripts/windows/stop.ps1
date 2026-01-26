# Quiz Overlay API - Arrêt du serveur (PowerShell)

# Remonter à la racine du projet depuis scripts/windows/
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$pidFile = Join-Path $projectRoot "api\.server.pid"

if (Test-Path $pidFile) {
    $serverPid = Get-Content $pidFile -Raw
    $serverPid = $serverPid.Trim()
    
    Write-Host "[ARRET] Arret du serveur (PID: $serverPid)..." -ForegroundColor Yellow
    
    try {
        $process = Get-Process -Id $serverPid -ErrorAction Stop
        
        if ($process.ProcessName -eq "node") {
            Stop-Process -Id $serverPid -Force
            Write-Host "[OK] Serveur arrete avec succes" -ForegroundColor Green
        } else {
            Write-Host "[ATTENTION] Le PID ne correspond pas a un processus Node.js" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ATTENTION] Processus deja arrete ou introuvable" -ForegroundColor Yellow
    }
    
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
    Write-Host "[ATTENTION] Aucun fichier PID trouve. Recherche des processus Node.js..." -ForegroundColor Yellow
    
    # Chercher les processus Node.js qui pourraient être le serveur
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*Interface OBS Jeu*"
    }
    
    if ($nodeProcesses) {
        Write-Host "[INFO] Processus Node.js trouves:" -ForegroundColor Cyan
        $nodeProcesses | ForEach-Object {
            Write-Host "  - PID: $($_.Id) | Path: $($_.Path)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "[INFO] Pour arreter un processus specifique, utilisez:" -ForegroundColor Yellow
        Write-Host "   Stop-Process -Id <PID> -Force" -ForegroundColor Gray
    } else {
        Write-Host "[OK] Aucun serveur en cours d'execution" -ForegroundColor Green
    }
}
