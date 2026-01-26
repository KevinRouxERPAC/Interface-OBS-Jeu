@echo off
chcp 65001 >nul
title Quiz Overlay - Arrêt

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║              QUIZ OVERLAY - ARRÊT DU SERVEUR             ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Aller dans le dossier du script
cd /d "%~dp0"

REM Lancer le script PowerShell d'arrêt
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\stop.ps1"

echo.
echo Appuyez sur une touche pour fermer...
pause >nul
