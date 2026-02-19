@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  Interface OBS Jeu - Arret du serveur
echo  ------------------------------------
echo.

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/shutdown' -Method POST -UseBasicParsing -TimeoutSec 3; Write-Host '  Serveur arrete.' } catch { if ($_.Exception.Response.StatusCode -eq $null) { Write-Host '  Le serveur ne repond pas (deja arrete ?)' } else { Write-Host '  Erreur:' $_.Exception.Message } }"

echo.
pause
