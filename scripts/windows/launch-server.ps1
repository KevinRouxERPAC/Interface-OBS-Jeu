# Quiz Overlay - Script de lancement automatique
# Lance le serveur en arrière-plan et ouvre l'admin

# Remonter à la racine du projet depuis scripts/windows/
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$apiDir = Join-Path $projectRoot "api"
$pidFile = Join-Path $apiDir ".server.pid"
$apiUrl = "http://localhost:3000"
$adminUrl = "$apiUrl/admin"

Push-Location $apiDir

# Vérifier si le serveur est déjà en cours d'exécution
if (Test-Path $pidFile) {
    $oldPid = (Get-Content $pidFile -Raw).Trim()
    try {
        $oldProcess = Get-Process -Id $oldPid -ErrorAction Stop
        if ($oldProcess.ProcessName -eq "node") {
            Write-Host "[INFO] Serveur deja en cours d'execution (PID: $oldPid)" -ForegroundColor Yellow
            Write-Host "[INFO] Ouverture de l'admin..." -ForegroundColor Cyan
            Start-Process $adminUrl
            Pop-Location
            exit 0
        }
    } catch {
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
}

# Vérifier le fichier .env
$envFile = Join-Path $apiDir ".env"
if (-not (Test-Path $envFile)) {
    $envExample = Join-Path $projectRoot ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[ATTENTION] Fichier .env cree depuis .env.example" -ForegroundColor Yellow
        Write-Host "[INFO] Veuillez configurer le fichier .env avant de relancer" -ForegroundColor Cyan
        Pop-Location
        exit 1
    } else {
        Write-Host "[ERREUR] Fichier .env.example non trouve" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Installer les dépendances si nécessaire
if (-not (Test-Path "node_modules")) {
    Write-Host "[INSTALLATION] Installation des dependances..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] Echec de l'installation des dependances" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Vérifier si Node.js est installé
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js non trouve"
    }
} catch {
    Write-Host "[ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Démarrer le serveur en arrière-plan
Write-Host "[DEMARRAGE] Demarrage du serveur..." -ForegroundColor Green
$env:NODE_ENV = "production"

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "node"
$processInfo.Arguments = "server.js"
$processInfo.WorkingDirectory = $apiDir
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.RedirectStandardOutput = $false
$processInfo.RedirectStandardError = $false

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
$process.Start() | Out-Null

# Sauvegarder le PID
$process.Id | Out-File -FilePath $pidFile -Encoding ASCII

Write-Host "[OK] Serveur demarre (PID: $($process.Id))" -ForegroundColor Green

Pop-Location

# Attendre que le serveur soit prêt
Write-Host "[ATTENTE] Attente du demarrage du serveur..." -ForegroundColor Cyan
$maxAttempts = 15
$attempt = 0
$serverReady = $false

while (-not $serverReady -and $attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "[OK] Serveur pret!" -ForegroundColor Green
        }
    } catch {
        $attempt++
        if ($attempt -lt $maxAttempts) {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
    }
}

Write-Host ""

if ($serverReady) {
    Write-Host "[INFO] Ouverture de l'admin dans le navigateur..." -ForegroundColor Cyan
    Start-Process $adminUrl
} else {
    Write-Host "[ATTENTION] Le serveur demarre mais ne repond pas encore" -ForegroundColor Yellow
    Write-Host "[INFO] Ouverture de l'admin (peut prendre quelques secondes)..." -ForegroundColor Cyan
    Start-Process $adminUrl
}

exit 0
