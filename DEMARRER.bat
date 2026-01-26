@echo off
chcp 65001 >nul
title Quiz Overlay - Démarrage

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         QUIZ OVERLAY - DÉMARRAGE AUTOMATIQUE             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Vérifier si Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installé sur ce système.
    echo.
    echo Veuillez installer Node.js depuis : https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Vérifier si PowerShell est disponible
where powershell.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] PowerShell n'est pas disponible sur ce système.
    pause
    exit /b 1
)

REM Aller dans le dossier du script
cd /d "%~dp0"

REM Lancer le script PowerShell qui fait tout le travail
echo [INFO] Démarrage en cours...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\launch-server.ps1"

REM Si le script se termine, attendre un peu avant de fermer
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [INFO] Le serveur est en cours d'exécution.
    echo [INFO] Pour arrêter le serveur, fermez cette fenêtre ou utilisez Ctrl+C.
    echo.
    echo Appuyez sur une touche pour fermer cette fenêtre...
    pause >nul
) else (
    echo.
    echo [ERREUR] Une erreur s'est produite lors du démarrage.
    echo.
    pause
)
