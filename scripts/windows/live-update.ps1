# Quiz Overlay - LiveUpdate : récupère les mises à jour depuis origin/main au lancement
# À utiliser avant de démarrer le serveur (DEMARRER.bat / launch-server.ps1)

# Racine du projet (depuis scripts/windows/)
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$gitDir = Join-Path $projectRoot ".git"

# Vérifier si Git est disponible
$gitExe = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitExe) {
    Write-Host "[LiveUpdate] Git non installe - mise a jour ignoree" -ForegroundColor DarkGray
    return
}

# Vérifier si on est dans un dépôt Git (clone)
if (-not (Test-Path $gitDir)) {
    Write-Host "[LiveUpdate] Ce dossier n'est pas un clone Git - mise a jour ignoree" -ForegroundColor DarkGray
    return
}

Push-Location $projectRoot
try {
    # Vérifier qu'on a une remote "origin"
    $remotes = git remote 2>&1
    if ($remotes -notmatch "origin") {
        Write-Host "[LiveUpdate] Aucune remote 'origin' - mise a jour ignoree" -ForegroundColor DarkGray
        Pop-Location
        return
    }

    Write-Host "[LiveUpdate] Verification des mises a jour sur main..." -ForegroundColor Cyan
    $fetchResult = git fetch origin main 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LiveUpdate] Impossible de recuperer les mises a jour (reseau ?)" -ForegroundColor Yellow
        Pop-Location
        return
    }

    $statusBefore = git rev-parse HEAD 2>$null
    $pullResult = git pull origin main --no-edit 2>&1
    $statusAfter = git rev-parse HEAD 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LiveUpdate] Mise a jour annulee (conflits ou modifications locales ?)" -ForegroundColor Yellow
        Write-Host "              Vous pouvez mettre a jour manuellement : git pull origin main" -ForegroundColor DarkGray
        Pop-Location
        return
    }

    if ($statusBefore -ne $statusAfter) {
        Write-Host "[LiveUpdate] Mise a jour installee - projet a jour avec main" -ForegroundColor Green
        # Si des fichiers package.json ou node_modules ont changé, suggérer npm install
        $apiPackage = Join-Path $projectRoot "api\package.json"
        if (Test-Path $apiPackage) {
            Write-Host "[LiveUpdate] Pensez a relancer si des dependances ont change (npm install dans api/)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "[LiveUpdate] Deja a jour avec main" -ForegroundColor Green
    }
} finally {
    Pop-Location
}
