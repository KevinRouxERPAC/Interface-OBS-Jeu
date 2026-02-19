@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  Interface OBS Jeu - Demarrage du serveur
echo  ----------------------------------------
echo.

if exist ".git" (
  echo  Verification des mises a jour depuis GitHub...
  powershell -NoProfile -Command "$url = 'https://github.com/KevinRouxERPAC/Interface-OBS-Jeu'; if (git remote get-url origin 2>$null) { git remote set-url origin $url } else { git remote add origin $url }; git fetch origin 2>$null; $br = git rev-parse --abbrev-ref HEAD 2>$null; if ($br) { $n = git rev-list HEAD..origin/$br --count 2>$null; if ([int]$n -gt 0) { Write-Host '  Mise a jour disponible ('$n' commit(s)). Pull...'; git pull origin $br } else { Write-Host '  Depot a jour.' } }"
  echo.
)

if not exist "node_modules" (
  echo  Installation des dependances...
  call npm install
  echo.
)

start "Interface OBS Jeu" cmd /k "npm start"

echo  Serveur lance dans une nouvelle fenetre.
echo  Pour arreter : double-cliquez sur ARRETER.bat
echo  Ou fermez la fenetre du serveur.
echo.
pause
