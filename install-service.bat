@echo off
setlocal enabledelayedexpansion

:: Script d'installation du service FHIRHub pour Windows
:: Ce script utilise NSSM (Non-Sucking Service Manager) pour créer un service Windows

echo =========================================================
echo      Installation de FHIRHub comme service Windows
echo =========================================================

:: Vérifier si on est admin
NET SESSION >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Ce script doit être exécuté en tant qu'administrateur
    echo Clic droit sur ce fichier et 'Exécuter en tant qu'administrateur'
    pause
    exit /b 1
)

:: Chemin de l'application
set "APP_DIR=%~dp0"
echo Répertoire de l'application: %APP_DIR%

:: Vérifier que Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js n'est pas détecté dans le PATH
    
    :: Vérifier si le script d'installation de Node.js existe
    if exist "%APP_DIR%setup-nodejs.bat" (
        echo Utilisation du script d'installation de Node.js...
        call "%APP_DIR%setup-nodejs.bat"
    ) else (
        echo ERREUR: Node.js n'est pas installé et le script d'installation n'est pas disponible.
        echo Veuillez installer Node.js v20 ou supérieur manuellement avant de continuer.
        echo Visitez https://nodejs.org/en/download/ pour les instructions.
        pause
        exit /b 1
    )
    
    :: Vérifier à nouveau Node.js
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo ERREUR: Node.js n'est toujours pas détecté dans le PATH après la tentative d'installation.
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node.js !NODE_VERSION! détecté

:: Vérifier si le chemin NSSM est dans le PATH ou s'il existe dans le dossier courant
set NSSM_PATH=
where nssm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('where nssm') do set "NSSM_PATH=%%i"
) else if exist "%APP_DIR%\nssm.exe" (
    set "NSSM_PATH=%APP_DIR%\nssm.exe"
) else (
    echo NSSM (Non-Sucking Service Manager) n'est pas trouvé.
    echo Voulez-vous télécharger NSSM automatiquement? (O/N)
    set /p DOWNLOAD_NSSM=
    
    if /i "!DOWNLOAD_NSSM!"=="O" (
        :: Télécharger NSSM
        echo Téléchargement de NSSM...
        powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip'}"
        
        :: Extraire NSSM
        echo Extraction de NSSM...
        powershell -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('%TEMP%\nssm.zip', '%TEMP%\nssm')}"
        
        :: Copier l'exécutable NSSM dans le dossier de l'application
        if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
            copy "%TEMP%\nssm\nssm-2.24\win64\nssm.exe" "%APP_DIR%" >nul
        ) else (
            copy "%TEMP%\nssm\nssm-2.24\win32\nssm.exe" "%APP_DIR%" >nul
        )
        
        set "NSSM_PATH=%APP_DIR%\nssm.exe"
        echo NSSM installé avec succès.
    ) else (
        echo ERREUR: NSSM est requis pour installer FHIRHub comme service Windows.
        echo Veuillez télécharger NSSM depuis https://nssm.cc/ et l'ajouter au PATH.
        pause
        exit /b 1
    )
)

echo Utilisation de NSSM: !NSSM_PATH!

:: Vérifier si le service existe déjà
%NSSM_PATH% status FHIRHub >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Un service FHIRHub existe déjà.
    echo Voulez-vous le remplacer? (O/N)
    set /p REPLACE_SERVICE=
    
    if /i "!REPLACE_SERVICE!"=="O" (
        echo Arrêt et suppression du service existant...
        %NSSM_PATH% stop FHIRHub confirm
        %NSSM_PATH% remove FHIRHub confirm
    ) else (
        echo Installation annulée.
        pause
        exit /b 0
    )
)

:: Obtenir le chemin vers node.exe
for /f "tokens=*" %%i in ('where node') do set "NODE_PATH=%%i"

:: Créer le service
echo Création du service FHIRHub...
%NSSM_PATH% install FHIRHub "%NODE_PATH%" "%APP_DIR%app.js"
%NSSM_PATH% set FHIRHub Description "FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
%NSSM_PATH% set FHIRHub AppDirectory "%APP_DIR%"
%NSSM_PATH% set FHIRHub AppStdout "%APP_DIR%logs\service-output.log"
%NSSM_PATH% set FHIRHub AppStderr "%APP_DIR%logs\service-error.log"
%NSSM_PATH% set FHIRHub AppEnvironmentExtra "NODE_ENV=production PORT=5000"
%NSSM_PATH% set FHIRHub Start SERVICE_AUTO_START

:: Créer le dossier de logs si nécessaire
if not exist "%APP_DIR%logs" mkdir "%APP_DIR%logs"

:: Démarrer le service
echo Voulez-vous démarrer le service maintenant? (O/N)
set /p START_SERVICE=

if /i "!START_SERVICE!"=="O" (
    echo Démarrage du service FHIRHub...
    %NSSM_PATH% start FHIRHub
    
    :: Vérifier si le service a démarré
    timeout /t 2 /nobreak >nul
    %NSSM_PATH% status FHIRHub >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Service FHIRHub démarré avec succès!
    ) else (
        echo Le service n'a pas pu démarrer correctement.
        echo Vérifiez les logs dans %APP_DIR%logs
    )
) else (
    echo Le service est installé mais n'a pas été démarré.
    echo Vous pouvez le démarrer manuellement via le Gestionnaire de services Windows.
)

echo.
echo ==========================================================
echo L'application sera accessible à l'adresse: http://localhost:5000
echo Commandes utiles:
echo   Vérifier l'état:   sc query FHIRHub
echo   Gérer le service:  services.msc (puis recherchez "FHIRHub")
echo   Logs du service:   %APP_DIR%logs\service-output.log
echo ==========================================================

pause