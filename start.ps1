# Quiz Overlay API - Démarrage simple (PowerShell)

param(
    [string]$Mode = "dev"
)

$apiDir = Join-Path $PSScriptRoot "api"
Push-Location $apiDir

# Charger ou créer .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Fichier .env manquant. Création depuis .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Fichier .env créé. Veuillez le configurer avant de relancer." -ForegroundColor Green
        Pop-Location
        exit 1
    } else {
        Write-Host "❌ Fichier .env.example non trouvé!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Installez les dépendances si nécessaire
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Cyan
    npm install
}

# Déterminer le mode
if ($Mode -eq "prod" -or $Mode -eq "production") {
    Write-Host "🚀 Démarrage en MODE PRODUCTION..." -ForegroundColor Green
    $env:NODE_ENV = "production"
    npm start
} else {
    Write-Host "🚀 Démarrage en MODE DÉVELOPPEMENT..." -ForegroundColor Green
    $env:NODE_ENV = "development"
    npm run dev
}

Pop-Location
