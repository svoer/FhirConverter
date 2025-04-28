#!/bin/bash

# Script de démarrage de FHIRHub
# Ce script initialise les répertoires nécessaires et lance l'application

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"

# Initialiser le convertisseur HL7 vers FHIR
echo "Initialisation du nouveau système de conversion HL7 vers FHIR..."

# Vérifier si les dossiers nécessaires existent et les créer sinon
if [ ! -d "src/converters" ]; then
  mkdir -p src/converters
fi

if [ ! -d "src/utils" ]; then
  mkdir -p src/utils
fi

if [ ! -d "src/db" ]; then
  mkdir -p src/db
fi

if [ ! -d "test_data" ]; then
  mkdir -p test_data
fi

# Les fichiers de conversion ont été restructurés, il n'est plus nécessaire d'appliquer des fixes directs
echo "Utilisation du convertisseur HL7 vers FHIR optimisé..."

# Créer les répertoires nécessaires s'ils n'existent pas
mkdir -p data/in data/out data/test french_terminology/cache

# Initialiser le système de terminologie français si nécessaire
if [ ! -f french_terminology/fhir_r4_french_systems.json ]; then
  echo "Initialisation des terminologies françaises..."
  python extract_french_systems.py
fi

# Vérifier si le fichier de configuration pour le SMT existe
if [ ! -f french_terminology/config.json ]; then
  echo "Création du fichier de configuration pour le Serveur Multi-Terminologies..."
  cat > french_terminology/config.json << EOL
{
  "authentication": {
    "enabled": false,
    "clientId": "",
    "clientSecret": "",
    "tokenUrl": "https://auth.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token"
  },
  "api": {
    "baseUrl": "https://smt.esante.gouv.fr/fhir",
    "timeout": 10000
  },
  "cache": {
    "enabled": true,
    "ttl": 86400,
    "systemCachePath": "french_terminology/cache/systems.json",
    "codeCachePath": "french_terminology/cache/codes.json"
  },
  "fallback": {
    "useLocal": true,
    "localDataPath": "french_terminology/fhir_r4_french_systems.json"
  }
}
EOL
fi

echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier les fichiers du frontend
echo "Vérification des fichiers du frontend..."

# Nettoyer l'historique pour éviter les rémanences
echo "Nettoyage de l'historique des conversions..."
node -e "try { require('./src/utils/historyFix').applyHistoryFixes(); } catch(e) { console.error('Erreur:', e.message); }"

# Exécuter le script de test pour le nom français
echo "Test du correctif d'extraction des noms français..."
node test_data/test_french_names.js

# Supprimer tous les fichiers temporaires
echo "Nettoyage des fichiers temporaires..."
find . -maxdepth 1 -type f -name "*.bak" -delete
find . -maxdepth 1 -type f -name "*.new" -delete
find . -maxdepth 1 -type f -name "*.tmp" -delete
find . -maxdepth 1 -type f -name "*.temp" -delete

# Démarrer l'application principale
echo "Démarrage du serveur FHIRHub..."
node server.js