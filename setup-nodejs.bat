@echo off
setlocal enabledelayedexpansion

:: Script d'installation de Node.js pour FHIRHub sous Windows
:: Ce script télécharge et installe Node.js v20 si nécessaire

echo =========================================================
echo      Installation de Node.js v20 pour FHIRHub
echo =========================================================

:: Définition de la version de Node.js à installer
set NODE_VERSION=20.15.1
set NODE_VERSION_MAJOR=20

:: Vérifier si Node.js est déjà installé
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set CURRENT_VERSION=%%i
    echo Node.js !CURRENT_VERSION! est déjà installé.
    
    :: Extraire la version majeure
    set CURRENT_VERSION_CLEAN=!CURRENT_VERSION:~1!
    for /f "tokens=1 delims=." %%a in ("!CURRENT_VERSION_CLEAN!") do set CURRENT_VERSION_MAJOR=%%a
    
    if !CURRENT_VERSION_MAJOR! GEQ %NODE_VERSION_MAJOR% (
        echo La version actuelle de Node.js est compatible avec FHIRHub.
        echo Aucune action requise.
        exit /b 0
    ) else (
        echo La version actuelle de Node.js (v!CURRENT_VERSION_MAJOR!.x) est inférieure à la version recommandée (v%NODE_VERSION_MAJOR%.x).
        echo.
        echo Options disponibles:
        echo 1) Continuer avec la version actuelle (non recommandé)
        echo 2) Télécharger et installer Node.js v%NODE_VERSION%
        echo.
        set /p CHOICE=Choisissez une option (1-2): 
        
        if "!CHOICE!"=="1" (
            echo Utilisation de la version actuelle de Node.js.
            exit /b 0
        ) else if "!CHOICE!"=="2" (
            goto download_nodejs
        ) else (
            echo Option invalide. Installation annulée.
            exit /b 1
        )
    )
) else (
    echo Node.js n'est pas trouvé dans le PATH.
    goto download_nodejs
)

:download_nodejs
echo.
echo Téléchargement et installation de Node.js v%NODE_VERSION%...

:: Déterminer l'architecture du système
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set ARCH=x64
) else (
    set ARCH=x86
)

:: URL de téléchargement
set NODEJS_MSI=node-v%NODE_VERSION%-win-%ARCH%.msi
set DOWNLOAD_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODEJS_MSI%
set DOWNLOAD_PATH=%TEMP%\%NODEJS_MSI%

echo Téléchargement depuis %DOWNLOAD_URL%
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%DOWNLOAD_PATH%'}"

if not exist "%DOWNLOAD_PATH%" (
    echo Échec du téléchargement de Node.js.
    exit /b 1
)

echo Installation de Node.js...
msiexec /i "%DOWNLOAD_PATH%" /quiet /norestart

:: Vérifier si l'installation a réussi
timeout /t 5 /nobreak >nul
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: L'installation de Node.js a échoué.
    echo Veuillez installer Node.js manuellement depuis https://nodejs.org/
    exit /b 1
)

:: Supprimer le fichier MSI temporaire
del "%DOWNLOAD_PATH%" >nul 2>&1

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION_INSTALLED=%%i
echo Node.js !NODE_VERSION_INSTALLED! installé avec succès.

exit /b 0