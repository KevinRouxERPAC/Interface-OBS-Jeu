@echo off
REM Quiz Overlay - Lanceur automatique
REM Lance le serveur et ouvre l'admin dans le navigateur

echo ========================================
echo   Quiz Overlay - Demarrage automatique
echo ========================================
echo.

REM Vérifier si PowerShell est disponible
where powershell.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] PowerShell n'est pas disponible sur ce systeme.
    pause
    exit /b 1
)

REM Déterminer le chemin du script
set "SCRIPT_DIR=%~dp0"
set "LAUNCH_SCRIPT=%SCRIPT_DIR%launch-server.ps1"

REM Vérifier si le script existe
if not exist "%LAUNCH_SCRIPT%" (
    echo [ERREUR] Le fichier launch-server.ps1 est introuvable.
    pause
    exit /b 1
)

REM Lancer le serveur et ouvrir l'admin
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCH_SCRIPT%"

REM Fermer la fenêtre après un court délai
timeout /t 2 /nobreak >nul
exit /b 0
