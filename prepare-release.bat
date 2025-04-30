@echo off
setlocal enableextensions enabledelayedexpansion

echo ==========================================================
echo          Préparation de la release FHIRHub
echo ==========================================================

REM Vérification de Git
where git >nul 2>nul
if %errorlevel% neq 0 (
  echo ERREUR: Git n'est pas installé. Veuillez installer Git avant de continuer.
  goto :end
)

REM Vérification de Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERREUR: Node.js n'est pas installé. Veuillez installer Node.js v18+ avant de continuer.
  goto :end
)

REM Vérification qu'on est dans un dépôt Git
if not exist ".git" (
  echo ERREUR: Ce dossier n'est pas un dépôt Git.
  echo Veuillez exécuter ce script à partir de la racine du dépôt Git FHIRHub.
  goto :end
)

REM Vérification que package.json existe
if not exist "package.json" (
  echo ERREUR: Fichier package.json introuvable.
  echo Veuillez exécuter ce script à partir de la racine du projet FHIRHub.
  goto :end
)

REM Lecture de la version actuelle depuis package.json
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set CURRENT_VERSION=%%i
echo Version actuelle: %CURRENT_VERSION%

REM Demande de la nouvelle version
set /p NEW_VERSION=Entrez la nouvelle version (au format x.y.z): 

REM Validation simplifiée du format de version (Windows batch a des limitations)
echo %NEW_VERSION% | findstr /r "^[0-9]*\.[0-9]*\.[0-9]*$" >nul
if %errorlevel% neq 0 (
  echo ERREUR: Format de version invalide. Utilisez le format x.y.z (ex: 1.2.0)
  goto :end
)

REM Mise à jour du package.json avec Powershell
echo Mise à jour de la version dans package.json...
powershell -Command "(Get-Content package.json) -replace '\"version\": \"%CURRENT_VERSION%\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"

REM Vérification des modifications non commitées
git status --porcelain > temp_status.txt
set /p GIT_STATUS=<temp_status.txt
del temp_status.txt

if not "%GIT_STATUS%"=="" (
  echo ATTENTION: Il y a des modifications non commitées dans votre dépôt.
  echo Ces modifications seront incluses dans la release.
  
  choice /c ON /m "Voulez-vous continuer"
  if errorlevel 2 (
    echo Préparation de release annulée.
    REM Restaurer la version originale
    powershell -Command "(Get-Content package.json) -replace '\"version\": \"%NEW_VERSION%\"', '\"version\": \"%CURRENT_VERSION%\"' | Set-Content package.json"
    goto :end
  )
)

REM Nettoyage des fichiers temporaires
echo Nettoyage des fichiers temporaires...
if exist "node_modules" rmdir /s /q node_modules
if exist "logs\*.log" del /q logs\*.log
if exist "data\temp\*" del /q data\temp\*
if exist "data\cache\*" del /q data\cache\*

REM Restauration des dépendances proprement
echo Installation des dépendances de production...
call npm ci --production

REM Création d'un dossier release
set RELEASE_DIR=release_%NEW_VERSION%
echo Préparation du dossier de release: %RELEASE_DIR%
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

REM Copie des fichiers essentiels
echo Copie des fichiers dans le dossier de release...
xcopy /s /y app.js "%RELEASE_DIR%\"
xcopy /s /y server.js "%RELEASE_DIR%\"
xcopy /s /y hl7Parser.js "%RELEASE_DIR%\"
xcopy /s /y hl7ToFhirAdvancedConverter.js "%RELEASE_DIR%\"
xcopy /s /y package.json "%RELEASE_DIR%\"
xcopy /s /y package-lock.json "%RELEASE_DIR%\"
xcopy /s /y README.md "%RELEASE_DIR%\"
xcopy /s /y french_terminology_adapter.js "%RELEASE_DIR%\"
xcopy /s /y swagger.js "%RELEASE_DIR%\"
xcopy /s /y install.sh "%RELEASE_DIR%\"
xcopy /s /y install.bat "%RELEASE_DIR%\"
xcopy /s /y start.sh "%RELEASE_DIR%\"
xcopy /s /y start.bat "%RELEASE_DIR%\"
xcopy /s /y install-service.sh "%RELEASE_DIR%\"
xcopy /s /y install-service.bat "%RELEASE_DIR%\"

REM Copie des dossiers
xcopy /s /y /i api "%RELEASE_DIR%\api"
xcopy /s /y /i middleware "%RELEASE_DIR%\middleware"
xcopy /s /y /i routes "%RELEASE_DIR%\routes"
xcopy /s /y /i src "%RELEASE_DIR%\src"
xcopy /s /y /i utils "%RELEASE_DIR%\utils"
xcopy /s /y /i french_terminology "%RELEASE_DIR%\french_terminology"
xcopy /s /y /i public "%RELEASE_DIR%\public"
xcopy /s /y /i docs "%RELEASE_DIR%\docs"

REM Création des dossiers de données
mkdir "%RELEASE_DIR%\data"
mkdir "%RELEASE_DIR%\data\cache"
mkdir "%RELEASE_DIR%\data\conversions"
mkdir "%RELEASE_DIR%\data\history"
mkdir "%RELEASE_DIR%\data\outputs"
mkdir "%RELEASE_DIR%\data\test"
mkdir "%RELEASE_DIR%\logs"
mkdir "%RELEASE_DIR%\backups"

REM Création d'un fichier .env de production avec PowerShell pour générer un secret aléatoire
echo Création du fichier .env de production...
powershell -Command "$randomSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_}); Set-Content -Path '%RELEASE_DIR%\.env' -Value @'
# Configuration FHIRHub Production
NODE_ENV=production
PORT=5000
DB_PATH=./data/fhirhub.db
LOG_LEVEL=info
JWT_SECRET=$randomSecret
'@"

REM Création d'un fichier CHANGELOG.md si nécessaire
if not exist "CHANGELOG.md" (
  echo Création d'un fichier CHANGELOG.md...
  echo # Journal des modifications> "%RELEASE_DIR%\CHANGELOG.md"
  echo.>> "%RELEASE_DIR%\CHANGELOG.md"
  echo ## v%NEW_VERSION% - %date:~-4%-%date:~3,2%-%date:~0,2%>> "%RELEASE_DIR%\CHANGELOG.md"
  echo.>> "%RELEASE_DIR%\CHANGELOG.md"
  echo ### Ajouts>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - Première release officielle de FHIRHub>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - Conversion complète de messages HL7 v2.5 vers FHIR R4>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - Support des terminologies françaises (ANS)>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - Interface utilisateur intuitive>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - API REST sécurisée>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - Système de cache intelligent>> "%RELEASE_DIR%\CHANGELOG.md"
  echo.>> "%RELEASE_DIR%\CHANGELOG.md"
  echo ### Modifications>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - N/A>> "%RELEASE_DIR%\CHANGELOG.md"
  echo.>> "%RELEASE_DIR%\CHANGELOG.md"
  echo ### Corrections>> "%RELEASE_DIR%\CHANGELOG.md"
  echo - N/A>> "%RELEASE_DIR%\CHANGELOG.md"
) else (
  copy /y CHANGELOG.md "%RELEASE_DIR%\CHANGELOG.md"
)

REM Création d'un fichier README.release.md
echo # FHIRHub v%NEW_VERSION% - Release Notes> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo Cette archive contient la version %NEW_VERSION% de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4.>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ## Installation rapide>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ### Linux/macOS>> "%RELEASE_DIR%\README.release.md"
echo ```bash>> "%RELEASE_DIR%\README.release.md"
echo # Donner les permissions d'exécution aux scripts>> "%RELEASE_DIR%\README.release.md"
echo chmod +x install.sh start.sh install-service.sh>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo # Installer l'application>> "%RELEASE_DIR%\README.release.md"
echo ./install.sh>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo # Démarrer l'application>> "%RELEASE_DIR%\README.release.md"
echo ./start.sh>> "%RELEASE_DIR%\README.release.md"
echo ```>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ### Windows>> "%RELEASE_DIR%\README.release.md"
echo ```>> "%RELEASE_DIR%\README.release.md"
echo # Installer l'application>> "%RELEASE_DIR%\README.release.md"
echo install.bat>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo # Démarrer l'application>> "%RELEASE_DIR%\README.release.md"
echo start.bat>> "%RELEASE_DIR%\README.release.md"
echo ```>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ## Installation comme service système>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ### Linux>> "%RELEASE_DIR%\README.release.md"
echo ```bash>> "%RELEASE_DIR%\README.release.md"
echo sudo ./install-service.sh>> "%RELEASE_DIR%\README.release.md"
echo ```>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ### Windows>> "%RELEASE_DIR%\README.release.md"
echo Exécutez `install-service.bat` en tant qu'administrateur.>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ## Accès à l'application>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo L'application sera accessible à l'adresse: http://localhost:5000>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo Identifiants par défaut:>> "%RELEASE_DIR%\README.release.md"
echo - Utilisateur: admin>> "%RELEASE_DIR%\README.release.md"
echo - Mot de passe: adminfhirhub>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo ## Documentation>> "%RELEASE_DIR%\README.release.md"
echo.>> "%RELEASE_DIR%\README.release.md"
echo Consultez le fichier README.md pour plus d'informations.>> "%RELEASE_DIR%\README.release.md"

REM Création d'une archive ZIP avec PowerShell
echo Création de l'archive ZIP...
powershell -Command "Compress-Archive -Path '%RELEASE_DIR%\*' -DestinationPath 'FHIRHub-%NEW_VERSION%.zip' -Force"

REM Nettoyage
echo Nettoyage...
rmdir /s /q "%RELEASE_DIR%"

REM Commit des changements
echo Commit des changements dans Git...
git add package.json
git commit -m "Préparation de la release v%NEW_VERSION%"
git tag -a "v%NEW_VERSION%" -m "Version %NEW_VERSION%"

echo ==========================================================
echo Release v%NEW_VERSION% préparée avec succès!
echo Archive créée: FHIRHub-%NEW_VERSION%.zip
echo Tag Git créé: v%NEW_VERSION%
echo.
echo Pour pousser le tag vers le dépôt distant, exécutez:
echo   git push origin v%NEW_VERSION%
echo.
echo Pour restaurer votre environnement de développement, exécutez:
echo   npm install
echo ==========================================================

:end
pause