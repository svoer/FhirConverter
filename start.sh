#!/bin/bash

# Script de démarrage pour FHIRHub
# Lance tous les composants nécessaires pour le convertisseur HL7 vers FHIR R4
# avec support pour les terminologies françaises

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"

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

# Ajouter les systèmes de terminologie français importants au fichier local si nécessaire
if [ -f french_terminology/fhir_r4_french_systems.json ]; then
  # Vérifier si les URLs ANS sont déjà présentes
  if ! grep -q "mos.esante.gouv.fr" french_terminology/fhir_r4_french_systems.json; then
    echo "Mise à jour des URLs des terminologies françaises..."
    # Cela serait normalement fait par le script Python extract_french_systems.py
    # mais nous ajoutons cette vérification pour nous assurer que les URLs sont présentes
    echo "Note: Les URLs ANS sont manquantes. Veuillez exécuter à nouveau extract_french_systems.py"
  fi
fi

echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier les fichiers statiques du frontend
echo "Vérification des fichiers du frontend..."
if [ ! -d "frontend/public" ]; then
  echo "ERREUR: Le répertoire frontend/public est manquant!"
  exit 1
fi

if [ ! -f "frontend/public/conversions.html" ]; then
  echo "ERREUR: La page de conversion est manquante!"
  exit 1
fi

if [ ! -f "frontend/public/index.html" ]; then
  echo "ERREUR: La page d'accueil est manquante!"
  exit 1
fi

if [ ! -d "frontend/public/css" ]; then
  echo "ERREUR: Le répertoire CSS est manquant!"
  exit 1
fi

# Démarrer l'application principale
echo "Démarrage du serveur FHIRHub..."
# Tuer toute instance précédente qui pourrait bloquer le port
pkill -f "node app.js" || true
sleep 1
node app.js