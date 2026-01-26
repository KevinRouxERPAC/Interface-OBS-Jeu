# Quiz Overlay API - Statut du serveur (PowerShell)

# Remonter à la racine du projet depuis scripts/windows/
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$pidFile = Join-Path $projectRoot "api\.server.pid"

Write-Host "[STATUT] Statut du serveur Quiz Overlay API" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $pidFile) {
    $serverPid = Get-Content $pidFile -Raw
    $serverPid = $serverPid.Trim()
    
    try {
        $process = Get-Process -Id $serverPid -ErrorAction Stop
        
        if ($process.ProcessName -eq "node") {
            Write-Host "[OK] Serveur en cours d'execution" -ForegroundColor Green
            Write-Host "   PID: $serverPid" -ForegroundColor Gray
            Write-Host "   Demarrage: $($process.StartTime)" -ForegroundColor Gray
            Write-Host "   Memoire: $([math]::Round($process.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
            
            # Tester si le serveur répond
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
                Write-Host "   Health: [OK] OK" -ForegroundColor Green
            } catch {
                Write-Host "   Health: [ATTENTION] Ne repond pas" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[ATTENTION] Le PID ne correspond pas a un processus Node.js" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERREUR] Serveur arrete (fichier PID obsolete)" -ForegroundColor Red
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[ERREUR] Serveur arrete" -ForegroundColor Red
    
    # Vérifier s'il y a des processus Node.js qui pourraient être le serveur
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*Interface OBS Jeu*"
    }
    
    if ($nodeProcesses) {
        Write-Host ""
        Write-Host "[ATTENTION] Processus Node.js detectes (sans fichier PID):" -ForegroundColor Yellow
        $nodeProcesses | ForEach-Object {
            Write-Host "   PID: $($_.Id) | Path: $($_.Path)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "[INFO] Commandes disponibles:" -ForegroundColor Cyan
Write-Host "   .\start.ps1      - Demarrer le serveur" -ForegroundColor Gray
Write-Host "   .\stop.ps1       - Arreter le serveur" -ForegroundColor Gray
Write-Host "   .\restart.ps1    - Redemarrer le serveur" -ForegroundColor Gray
Write-Host "   .\status.ps1    - Afficher le statut" -ForegroundColor Gray
