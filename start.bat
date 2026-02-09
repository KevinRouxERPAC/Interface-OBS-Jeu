@echo off
title Qui veut passer pour un teube - Serveur
echo.
echo ========================================
echo   Qui veut passer pour un teube
echo   Demarrage du serveur...
echo ========================================
echo.

cd /d "%~dp0server"

:: Verifier que Node.js est installe
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH.
    echo Telechargez Node.js sur https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Installer les dependances si necessaire
if not exist "node_modules" (
    echo Installation des dependances...
    call npm install --production
    echo.
)

:: Demarrer le serveur
echo Lancement du serveur...
echo.
node index.js

:: Si le serveur se ferme
echo.
echo Le serveur s'est arrete.
pause
