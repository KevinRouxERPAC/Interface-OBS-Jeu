# Quiz Overlay API - Démarrage simple (PowerShell)

param(
    [string]$Mode = "dev"
)

# Remonter à la racine du projet depuis scripts/windows/
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# LiveUpdate : récupérer les mises à jour depuis main avant de démarrer
$liveUpdateScript = Join-Path $PSScriptRoot "live-update.ps1"
if (Test-Path $liveUpdateScript) {
    & $liveUpdateScript
}

Push-Location $projectRoot

# Charger ou créer .env
if (-not (Test-Path ".env")) {
    Write-Host "[ATTENTION] Fichier .env manquant. Création depuis .env.example..." -ForegroundColor Yellow
    $envExample = Join-Path $projectRoot ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample ".env"
        Write-Host "[OK] Fichier .env créé. Veuillez le configurer avant de relancer." -ForegroundColor Green
        Pop-Location
        exit 1
    } else {
        Write-Host "[ERREUR] Fichier .env.example non trouvé à la racine!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Installez les dépendances si nécessaire
if (-not (Test-Path "node_modules")) {
    Write-Host "[INSTALLATION] Installation des dépendances..." -ForegroundColor Cyan
    npm install
}

# Déterminer le mode
if ($Mode -eq "prod" -or $Mode -eq "production") {
    Write-Host "[DEMARRAGE] Démarrage en MODE PRODUCTION..." -ForegroundColor Green
    $env:NODE_ENV = "production"
    
    # Vérifier si le serveur est déjà en cours d'exécution
    $pidFile = Join-Path $projectRoot ".server.pid"
    if (Test-Path $pidFile) {
        $oldPid = (Get-Content $pidFile -Raw).Trim()
        try {
            $oldProcess = Get-Process -Id $oldPid -ErrorAction Stop
            if ($oldProcess.ProcessName -eq "node") {
                Write-Host "[ERREUR] Un serveur est déjà en cours d'exécution (PID: $oldPid)" -ForegroundColor Red
                Write-Host "[INFO] Utilisez .\stop.ps1 pour l'arrêter d'abord" -ForegroundColor Yellow
                Pop-Location
                exit 1
            }
        } catch {
            Remove-Item $pidFile -ErrorAction SilentlyContinue
        }
    }
    
    # Démarrer en arrière-plan et sauvegarder le PID
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "node"
    $processInfo.Arguments = "server.js"
    $processInfo.WorkingDirectory = $projectRoot
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    $process.Start() | Out-Null
    
    # Sauvegarder le PID
    $process.Id | Out-File -FilePath $pidFile -Encoding ASCII
    
    Write-Host "[OK] Serveur démarré (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "[INFO] Pour arrêter: .\stop.ps1" -ForegroundColor Cyan
    
    # Attendre que le processus se termine
    $process.WaitForExit()
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
    Write-Host "[DEMARRAGE] Démarrage en MODE DÉVELOPPEMENT..." -ForegroundColor Green
    $env:NODE_ENV = "development"
    npm run dev
}

Pop-Location
