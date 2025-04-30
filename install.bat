@echo off
setlocal enableextensions

echo ==========================================================
echo      Installation de FHIRHub - Convertisseur HL7 vers FHIR
echo ==========================================================

REM Vérification de l'environnement
echo [1/6] Vérification de l'environnement...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo X Node.js n'est pas installé. Veuillez installer Node.js v18+ avant de continuer.
  echo   https://nodejs.org/fr/download/
  exit /b 1
)

REM Vérification de la version de Node.js
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 18 (
  echo X Version de Node.js trop ancienne: %NODE_VERSION%. FHIRHub requiert Node.js v18+.
  echo   Veuillez mettre à jour Node.js avant de continuer.
  exit /b 1
)
if %NODE_VERSION% GTR 20 (
  echo X Version de Node.js trop récente: v%NODE_VERSION%. FHIRHub requiert Node.js v18-v20.
  echo   Certaines dépendances comme better-sqlite3 peuvent ne pas être compatibles avec Node.js v%NODE_VERSION%.
  echo   Nous recommandons d'utiliser Node.js v20.x LTS pour une compatibilité optimale.
  echo.
  choice /c ON /m "Voulez-vous quand même continuer"
  if errorlevel 2 (
    echo Installation annulée.
    exit /b 1
  )
  echo [33m^![0m Installation avec Node.js v%NODE_VERSION% - certaines fonctionnalités pourraient ne pas fonctionner correctement.
)

echo ✓ Environnement compatible (Node.js v%NODE_VERSION%)

REM Création des répertoires nécessaires
echo [2/6] Création des répertoires...
if not exist "data\conversions" mkdir data\conversions
if not exist "data\history" mkdir data\history
if not exist "data\outputs" mkdir data\outputs
if not exist "data\test" mkdir data\test
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups
echo ✓ Structure des dossiers de données créée

REM Installation des dépendances
echo [3/6] Installation des dépendances...

REM Vérification du fichier package.json
if not exist "package.json" (
  echo X Erreur: Fichier package.json introuvable.
  echo   Création d'un fichier package.json par défaut...
  
  echo {^
  "name": "fhirhub",^
  "version": "1.0.0",^
  "description": "Convertisseur HL7 vers FHIR avec terminologies françaises",^
  "main": "app.js",^
  "scripts": {^
    "start": "node app.js",^
    "dev": "nodemon app.js"^
  },^
  "dependencies": {^
    "better-sqlite3": "^8.5.0",^
    "body-parser": "^1.20.2",^
    "cors": "^2.8.5",^
    "dotenv": "^16.0.3",^
    "express": "^4.18.2",^
    "fhir": "^4.12.0",^
    "fhir.js": "^0.0.22",^
    "helmet": "^7.0.0",^
    "hl7-parser": "^1.0.1",^
    "hl7-standard": "^1.0.2",^
    "jsonwebtoken": "^9.0.0",^
    "morgan": "^1.10.0",^
    "simple-hl7": "^3.2.0",^
    "swagger-jsdoc": "^6.2.8",^
    "swagger-ui-express": "^4.6.3",^
    "uuid": "^9.0.0"^
  },^
  "devDependencies": {^
    "nodemon": "^2.0.22"^
  }^
}> package.json
)

REM Suppression complet du node_modules s'il existe pour une installation propre
if exist "node_modules" (
  echo Suppression des modules existants pour une installation propre...
  rmdir /s /q node_modules
)

echo Installation des dépendances Node.js...
call npm cache clean --force
echo Nettoyage du cache npm terminé

REM Utiliser npm install avec l'option --no-optional pour éviter les problèmes de compilation sous Windows
echo Installation des packages avec --no-optional pour éviter les problèmes de compilation...
call npm install --no-optional

REM Vérifier que les dépendances critiques sont bien installées
echo Vérification des dépendances critiques...
if not exist "node_modules\express" (
  echo Dépendance express manquante. Installation spécifique...
  call npm install express --save
)
if not exist "node_modules\better-sqlite3" (
  echo Dépendance better-sqlite3 manquante. Installation spécifique...
  call npm install better-sqlite3 --save
)

REM Configuration de l'environnement
echo [4/6] Configuration de l'environnement...
if not exist ".env" (
  echo PORT=5000> .env
  echo DB_PATH=./data/fhirhub.db>> .env
  echo LOG_LEVEL=info>> .env
  echo JWT_SECRET=>> .env
  echo ✓ Fichier .env créé avec succès
) else (
  echo ℹ️ Fichier .env existant conservé
)

REM Initialisation de la base de données
echo [5/6] Initialisation de la base de données...
echo [TERMINOLOGY] Préparation des terminologies françaises...

REM Vérifier que le dossier french_terminology existe et contient les fichiers nécessaires
if not exist "french_terminology" (
  echo ⚠️ Le dossier french_terminology n'existe pas. Création...
  mkdir french_terminology
  mkdir french_terminology\cache
)

REM Créer ou vérifier le fichier de configuration des OIDs
if not exist "french_terminology\ans_oids.json" (
  echo ⚠️ Création du fichier ans_oids.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "systems": {^
    "ins": "urn:oid:1.2.250.1.213.1.4.8",^
    "rpps": "urn:oid:1.2.250.1.71.4.2.1",^
    "adeli": "urn:oid:1.2.250.1.71.4.2.2",^
    "finess": "urn:oid:1.2.250.1.71.4.2.2"^
  }^
}> french_terminology\ans_oids.json
)

REM Créer ou vérifier le fichier de codes communs
if not exist "french_terminology\ans_common_codes.json" (
  echo ⚠️ Création du fichier ans_common_codes.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "codeSystemMap": {^
    "profession": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",^
    "specialite": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale"^
  }^
}> french_terminology\ans_common_codes.json
)

REM Créer ou vérifier le fichier des systèmes de terminologie
if not exist "french_terminology\ans_terminology_systems.json" (
  echo ⚠️ Création du fichier ans_terminology_systems.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "systems": {^
    "LOINC": "http://loinc.org",^
    "UCUM": "http://unitsofmeasure.org",^
    "SNOMED-CT": "http://snomed.info/sct"^
  }^
}> french_terminology\ans_terminology_systems.json
)

REM Vérifier que la configuration est complète
if not exist "french_terminology\config.json" (
  echo ⚠️ Création du fichier config.json par défaut...
  echo {^
  "version": "1.0.0",^
  "lastUpdated": "2025-04-28T10:15:30Z",^
  "cacheEnabled": true,^
  "cacheDuration": 86400,^
  "defaultLanguage": "fr"^
}> french_terminology\config.json
)

REM Finalisation
echo [6/6] Finalisation de l'installation...

echo ==========================================================
echo      ✓ Installation de FHIRHub terminée avec succès
echo ==========================================================
echo.
echo Pour démarrer l'application :
echo   start.bat
echo.
echo Site web accessible sur : http://localhost:5000
echo Identifiants par défaut :
echo   Utilisateur : admin
echo   Mot de passe : adminfhirhub
echo.
echo Clé API de test : dev-key
echo Documentation API : http://localhost:5000/api-docs
echo ==========================================================

pause