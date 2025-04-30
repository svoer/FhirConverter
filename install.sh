#!/bin/bash

# Script d'installation pour l'application FHIRHub
# Version 1.0.0

echo "=========================================================="
echo "     Installation de FHIRHub - Convertisseur HL7 vers FHIR"
echo "=========================================================="

# Vérification de l'environnement
echo "[1/6] Vérification de l'environnement..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js n'est pas installé. Veuillez installer Node.js v18+ avant de continuer."
  echo "   https://nodejs.org/fr/download/"
  exit 1
fi

# Vérification de la version de Node.js
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Version de Node.js trop ancienne: $(node -v). FHIRHub requiert Node.js v18+."
  echo "   Veuillez mettre à jour Node.js avant de continuer."
  exit 1
fi
if [ "$NODE_VERSION" -gt 20 ]; then
  echo "❌ Version de Node.js trop récente: $(node -v). FHIRHub requiert Node.js v18-v20."
  echo "   Certaines dépendances comme better-sqlite3 peuvent ne pas être compatibles avec Node.js v$(node -v)."
  echo "   Nous recommandons d'utiliser Node.js v20.x LTS pour une compatibilité optimale."
  echo
  echo "Voulez-vous quand même continuer? (o/n)"
  read -r response
  if [[ ! "$response" =~ ^[oO]$ ]]; then
    echo "Installation annulée."
    exit 1
  fi
  echo "⚠️ Installation avec Node.js $(node -v) - certaines fonctionnalités pourraient ne pas fonctionner correctement."
fi

echo "✅ Environnement compatible (Node.js $(node -v))"

# Création des répertoires nécessaires
echo "[2/6] Création des répertoires..."
mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups
echo "✅ Structure des dossiers de données créée"

# Installation des dépendances
echo "[3/6] Installation des dépendances..."
npm install

# Configuration de l'environnement
echo "[4/6] Configuration de l'environnement..."
if [ ! -f "./.env" ]; then
  cat > ./.env << EOF
# Configuration FHIRHub
PORT=5000
DB_PATH=./data/fhirhub.db
LOG_LEVEL=info
JWT_SECRET=$(openssl rand -hex 32)
EOF
  echo "✅ Fichier .env créé avec succès"
else
  echo "ℹ️ Fichier .env existant conservé"
fi

# Initialisation de la base de données
echo "[5/6] Initialisation de la base de données..."
echo "[TERMINOLOGY] Préparation des terminologies françaises..."

# Vérifier que le dossier french_terminology existe et contient les fichiers nécessaires
if [ ! -d "./french_terminology" ]; then
  echo "⚠️ Le dossier french_terminology n'existe pas. Création..."
  mkdir -p ./french_terminology
  mkdir -p ./french_terminology/cache
fi

# Créer ou vérifier le fichier de configuration des OIDs
if [ ! -f "./french_terminology/ans_oids.json" ]; then
  echo "⚠️ Création du fichier ans_oids.json par défaut..."
  cat > ./french_terminology/ans_oids.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "systems": {
    "ins": "urn:oid:1.2.250.1.213.1.4.8",
    "rpps": "urn:oid:1.2.250.1.71.4.2.1",
    "adeli": "urn:oid:1.2.250.1.71.4.2.2",
    "finess": "urn:oid:1.2.250.1.71.4.2.2"
  }
}
EOF
fi

# Créer ou vérifier le fichier de codes communs
if [ ! -f "./french_terminology/ans_common_codes.json" ]; then
  echo "⚠️ Création du fichier ans_common_codes.json par défaut..."
  cat > ./french_terminology/ans_common_codes.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "codeSystemMap": {
    "profession": "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",
    "specialite": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale"
  }
}
EOF
fi

# Créer ou vérifier le fichier des systèmes de terminologie
if [ ! -f "./french_terminology/ans_terminology_systems.json" ]; then
  echo "⚠️ Création du fichier ans_terminology_systems.json par défaut..."
  cat > ./french_terminology/ans_terminology_systems.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "systems": {
    "LOINC": "http://loinc.org",
    "UCUM": "http://unitsofmeasure.org",
    "SNOMED-CT": "http://snomed.info/sct"
  }
}
EOF
fi

# Vérifier que la configuration est complète
if [ ! -f "./french_terminology/config.json" ]; then
  echo "⚠️ Création du fichier config.json par défaut..."
  cat > ./french_terminology/config.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "2025-04-28T10:15:30Z",
  "cacheEnabled": true,
  "cacheDuration": 86400,
  "defaultLanguage": "fr"
}
EOF
fi

# Finalisation
echo "[6/6] Finalisation de l'installation..."
chmod +x ./start.sh

echo "=========================================================="
echo "     ✅ Installation de FHIRHub terminée avec succès"
echo "=========================================================="
echo ""
echo "Pour démarrer l'application :"
echo "  ./start.sh"
echo ""
echo "Site web accessible sur : http://localhost:5000"
echo "Identifiants par défaut :"
echo "  Utilisateur : admin"
echo "  Mot de passe : adminfhirhub"
echo ""
echo "Clé API de test : dev-key"
echo "Documentation API : http://localhost:5000/api-docs"
echo "=========================================================="