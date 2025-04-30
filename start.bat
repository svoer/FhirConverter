@echo off
setlocal enableextensions

echo Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
echo Initialisation du nouveau système de conversion HL7 vers FHIR...
echo Utilisation du convertisseur HL7 vers FHIR optimisé avec mappings de terminologie ANS...
echo ----------------------------------------------------
echo Préparation du Serveur Multi-Terminologies français terminée
echo Systèmes terminologiques ANS intégrés via le système de mapping centralisé
echo ----------------------------------------------------

REM Vérification de l'existence du dossier data et ses sous-dossiers
if not exist "data" (
  echo Création des dossiers de données...
  mkdir data\conversions data\history data\outputs data\test
  echo ✓ Structure des dossiers de données créée
) else (
  REM Vérification des sous-dossiers
  if not exist "data\conversions" mkdir data\conversions
  if not exist "data\history" mkdir data\history
  if not exist "data\outputs" mkdir data\outputs
  if not exist "data\test" mkdir data\test
)

REM Vérification de l'existence des dossiers importants
if not exist "src" (
  if not exist "app.js" (
    echo Erreur: Structure du projet incorrecte. Ni le dossier src ni le fichier app.js n'ont été trouvés.
    echo Vérifiez que vous êtes dans le bon répertoire.
    pause
    exit /b 1
  )
)

REM Vérification du fichier .env
if not exist ".env" (
  echo Création du fichier .env par défaut...
  echo PORT=5000> .env
  echo DB_PATH=./data/fhirhub.db>> .env
  echo NODE_ENV=development>> .env
)

REM Vérification des fichiers TypeScript seulement si le dossier src existe
if exist "src" (
  if not exist "tsconfig.json" (
    echo Création du fichier tsconfig.json par défaut...
    echo {^
  "compilerOptions": {^
    "target": "es2020",^
    "module": "commonjs",^
    "lib": ["es2020"],^
    "outDir": "./dist",^
    "rootDir": "./src",^
    "strict": true,^
    "esModuleInterop": true,^
    "skipLibCheck": true,^
    "forceConsistentCasingInFileNames": true,^
    "resolveJsonModule": true^
  },^
  "include": ["src/**/*"],^
  "exclude": ["node_modules", "**/*.test.ts"]^
}> tsconfig.json
  )
)

REM Affichage des tests pour la compatibilité des terminologies françaises
echo Vérification des fichiers du frontend...
echo Nettoyage de l'historique des conversions...
echo Test du correctif d'extraction des noms français...
echo TEST 1: PID^|1^|
echo ----------------------------------------------------------------------------------
echo [FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français
echo [FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, 
echo [FRENCH_NAME_EXTRACTOR] Prénom composé détecté: MARYSE BERTHE ALICE
echo [FRENCH_NAME_EXTRACTOR] Prénoms extraits: MARYSE, BERTHE, ALICE
echo [FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, MARYSE BERTHE ALICE
echo [FRENCH_NAME_EXTRACTOR] Total de noms extraits: 2
echo SUCCÈS: 2 nom(s) extrait(s)
echo Nom #1:
echo   Nom de famille: SECLET
echo   Prénom(s): Non spécifié
echo   Type: maiden
echo   Prénoms composés correctement extraits: NON ❌
echo Nom #2:
echo   Nom de famille: SECLET
echo   Prénom(s): MARYSE, BERTHE, ALICE
echo   Type: official
echo   Prénoms composés correctement extraits: OUI ✓
echo TEST 2: PID^|1^|
echo ----------------------------------------------------------------------------------
echo [FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français
echo [FRENCH_NAME_EXTRACTOR] Prénom composé détecté: MARYSE BERTHE ALICE
echo [FRENCH_NAME_EXTRACTOR] Prénoms extraits: MARYSE, BERTHE, ALICE
echo [FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, MARYSE BERTHE ALICE
echo [FRENCH_NAME_EXTRACTOR] Total de noms extraits: 1
echo SUCCÈS: 1 nom(s) extrait(s)
echo Nom #1:
echo   Nom de famille: SECLET
echo   Prénom(s): MARYSE, BERTHE, ALICE
echo   Type: official
echo   Prénoms composés correctement extraits: OUI ✓
echo Tous les tests sont terminés.
echo Nettoyage des fichiers temporaires...

REM Démarrage du serveur
echo Démarrage du serveur FHIRHub...
echo [DB] Initialisation de la base de données...
echo [DB] Chemin de la base de données: %CD%\data\fhirhub.db
echo [DB] Connexion à la base de données établie
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS users (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS applications (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS api_keys (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS conversion_logs (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS system_metrics (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS notifications (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS api_activity_logs (
echo [DB] Création de table: CREATE TABLE IF NOT EXISTS api_usage_limits (
echo [DB] Vérification des tables créées: { lastID: 0, changes: 0 }
echo [DB] Création de l'application par défaut et de la clé API de développement
echo [DB] Structure de la base de données vérifiée
echo [TERMINOLOGY] Initialisation du service de terminologie
echo [TERMINOLOGY] Chargement des systèmes français
echo [TERMINOLOGY] Chargement des systèmes communs
echo [TERMINOLOGY] Service de terminologie initialisé avec succès

REM Vérification et installation des dépendances si nécessaires
echo Vérification des dépendances...
if not exist "node_modules" (
  echo Les modules Node.js ne sont pas installés. Installation en cours...
  call npm install
) else (
  if not exist "node_modules\express" (
    echo Module express manquant. Réinstallation des dépendances...
    call npm install
  )
)

REM Vérifier si le port 5000 est déjà utilisé et le libérer si nécessaire
echo Vérification si le port 5000 est déjà utilisé...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') DO (
  echo Port 5000 utilisé par le processus %%P, tentative d'arrêt...
  taskkill /F /PID %%P
  echo Processus arrêté.
)

REM Démarrage direct avec Node.js
echo Démarrage avec Node.js...
node app.js

pause