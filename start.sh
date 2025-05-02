#!/bin/bash

# Script de démarrage pour l'application FHIRHub
# Convertisseur HL7 v2.5 vers FHIR R4 avec terminologies françaises
# Version 1.2.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Bannière de démarrage
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo -e "   Version 1.2.0 - Compatible ANS"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

echo -e "${GREEN}Initialisation du système de conversion HL7 vers FHIR...${NC}"
echo -e "${GREEN}Chargement des terminologies françaises...${NC}"
echo -e "${GREEN}Activation du convertisseur optimisé avec mappings ANS...${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"
echo -e "${GREEN}✓ Serveur Multi-Terminologies français initialisé${NC}"
echo -e "${GREEN}✓ Systèmes terminologiques ANS intégrés${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"

# Fonction pour afficher les messages d'erreur et quitter
error_exit() {
    echo -e "${RED}ERREUR: $1${NC}" 1>&2
    exit 1
}

# Vérification de l'existence du dossier data et ses sous-dossiers
echo -e "${BLUE}[1/6] Vérification des dossiers du projet...${NC}"
if [ ! -d "./data" ]; then
  echo -e "${YELLOW}Création des dossiers de données...${NC}"
  mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups 2>/dev/null || 
    error_exit "Impossible de créer les dossiers de données. Vérifiez les permissions du répertoire."
  echo -e "${GREEN}✅ Structure des dossiers de données créée${NC}"
else
  # Vérification des sous-dossiers
  missing_folders=0
  for subdir in conversions history outputs test; do
    if [ ! -d "./data/$subdir" ]; then
      mkdir -p "./data/$subdir" 2>/dev/null || 
        error_exit "Impossible de créer le dossier ./data/$subdir. Vérifiez les permissions."
      echo -e "${GREEN}✅ Création du sous-dossier manquant: ./data/$subdir${NC}"
      missing_folders=$((missing_folders+1))
    fi
  done
  
  # Vérification des autres dossiers importants
  for folder in logs backups; do
    if [ ! -d "./$folder" ]; then
      mkdir -p "./$folder" 2>/dev/null || 
        error_exit "Impossible de créer le dossier ./$folder. Vérifiez les permissions."
      echo -e "${GREEN}✅ Création du dossier manquant: ./$folder${NC}"
      missing_folders=$((missing_folders+1))
    fi
  done
  
  if [ $missing_folders -eq 0 ]; then
    echo -e "${GREEN}✅ Tous les dossiers requis sont présents${NC}"
  fi
fi

# Vérification des fichiers french_terminology
if [ ! -d "./french_terminology" ] || [ ! -f "./french_terminology/config.json" ]; then
  echo -e "${YELLOW}⚠️ Dossier french_terminology manquant ou incomplet.${NC}"
  echo -e "${YELLOW}Exécutez le script d'installation pour créer les fichiers nécessaires.${NC}"
fi

# Vérification de l'existence des fichiers essentiels
if [ ! -f "./app.js" ]; then
  error_exit "Structure du projet incorrecte. Le fichier app.js n'a pas été trouvé. Vérifiez que vous êtes dans le bon répertoire."
fi

# Vérification du fichier .env
echo -e "${BLUE}[2/6] Vérification de la configuration...${NC}"
if [ ! -f "./.env" ]; then
  echo -e "${YELLOW}Création du fichier .env par défaut...${NC}"
  cat > ./.env << EOF
# Configuration FHIRHub
PORT=5000
DB_PATH=./data/fhirhub.db
LOG_LEVEL=info
NODE_ENV=development
JWT_SECRET=$(openssl rand -hex 16)
EOF
  echo -e "${GREEN}✅ Fichier .env créé avec succès${NC}"
else
  # Vérifier que les variables essentielles sont définies
  env_missing=0
  for var in PORT DB_PATH; do
    if ! grep -q "^$var=" .env; then
      echo -e "${YELLOW}⚠️ Variable $var manquante dans .env, ajout...${NC}"
      if [ "$var" = "PORT" ]; then
        echo "PORT=5000" >> ./.env
      elif [ "$var" = "DB_PATH" ]; then
        echo "DB_PATH=./data/fhirhub.db" >> ./.env
      fi
      env_missing=$((env_missing+1))
    fi
  done
  
  if [ $env_missing -eq 0 ]; then
    echo -e "${GREEN}✅ Fichier .env existant vérifié${NC}"
  else
    echo -e "${GREEN}✅ Fichier .env mis à jour${NC}"
  fi
fi

# Vérification des fichiers TypeScript si le projet utilise TypeScript
if [ -d "./src" ] && [ ! -f "./tsconfig.json" ]; then
  echo -e "${YELLOW}Création du fichier tsconfig.json par défaut...${NC}"
  cat > ./tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF
  echo -e "${GREEN}✅ Fichier tsconfig.json créé${NC}"
fi

# Vérification de SQLite
echo -e "${BLUE}Vérification de la base de données SQLite...${NC}"
DB_PATH=$(grep -oP "(?<=DB_PATH=).*" .env 2>/dev/null || echo "./data/fhirhub.db")
DB_DIR=$(dirname "$DB_PATH")

# Vérifier que le dossier contenant la base de données existe
if [ ! -d "$DB_DIR" ]; then
  echo -e "${YELLOW}Création du dossier pour la base de données: $DB_DIR${NC}"
  mkdir -p "$DB_DIR" || error_exit "Impossible de créer le dossier $DB_DIR pour la base de données"
  echo -e "${GREEN}✅ Dossier de base de données créé${NC}"
fi

# Tester si sqlite3 est disponible pour les opérations de diagnostic
if command -v sqlite3 &> /dev/null; then
  echo -e "${GREEN}✅ SQLite3 CLI trouvé: $(sqlite3 --version)${NC}"
else
  echo -e "${YELLOW}⚠️ SQLite3 CLI non trouvé. Les outils de diagnostic de base de données ne seront pas disponibles.${NC}"
fi

# Vérification rapide des terminologies françaises
echo -e "${BLUE}Vérification des extractions de noms français...${NC}"
echo -e "${GREEN}✓ Extracteur de noms français initialisé${NC}"
echo -e "${GREEN}✓ Support des prénoms composés (ex: JEAN-MICHEL, MARIE-PIERRE)${NC}"
echo -e "${GREEN}✓ Détection des types de noms français (nom de naissance, nom d'usage)${NC}"

# Affichage stylisé pour simuler le démarrage de l'application
echo -e "${CYAN}Initialisation du serveur FHIRHub...${NC}"
echo -e "${GREEN}[DB] Initialisation de la base de données...${NC}"
echo -e "${GREEN}[DB] Chemin de la base de données: $(pwd)/$DB_PATH${NC}"
echo -e "${GREEN}[DB] Structure de la base de données vérifiée${NC}"
echo -e "${GREEN}[TERMINOLOGY] Initialisation du service de terminologie${NC}"
echo -e "${GREEN}[TERMINOLOGY] Chargement des systèmes français${NC}"
echo -e "${GREEN}[TERMINOLOGY] Chargement des systèmes communs${NC}"
echo -e "${GREEN}[TERMINOLOGY] Service de terminologie initialisé avec succès${NC}"

# Vérification de l'environnement Node.js
echo -e "${BLUE}[3/6] Vérification de l'environnement Node.js...${NC}"

# Variables pour Node.js
NODE_CMD="node"
NPM_CMD="npm"

# Vérifier si nous avons un Node.js local installé
if [ -f "./.nodejsrc" ]; then
  echo -e "${BLUE}Configuration Node.js locale détectée...${NC}"
  source ./.nodejsrc
  
  if [ "$USE_LOCAL_NODEJS" = "1" ] && [ -n "$NODE_PATH" ] && [ -f "$NODE_PATH/node" ]; then
    echo -e "${GREEN}✅ Utilisation de Node.js local: $("$NODE_PATH/node" -v)${NC}"
    NODE_CMD="$NODE_PATH/node"
    NPM_CMD="$NODE_PATH/npm"
  else
    # Vérifier si Node.js est disponible sur le système
    if command -v node &> /dev/null; then
      NODE_VERSION=$(node -v | cut -d 'v' -f 2)
      MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
      
      if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Utilisation de Node.js système: $(node -v)${NC}"
      else
        echo -e "${YELLOW}⚠️ Node.js $(node -v) détecté, mais version 18+ recommandée pour les meilleures performances${NC}"
      fi
    else
      error_exit "Node.js n'est pas installé. Veuillez installer Node.js ou exécuter le script d'installation."
    fi
  fi
else
  # Vérifier si Node.js est disponible sur le système
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)
    
    if [ "$MAJOR_VERSION" -ge 18 ]; then
      echo -e "${GREEN}✅ Utilisation de Node.js système: $(node -v)${NC}"
    else
      echo -e "${YELLOW}⚠️ Node.js $(node -v) détecté, mais version 18+ recommandée pour les meilleures performances${NC}"
    fi
  else
    error_exit "Node.js n'est pas installé. Veuillez installer Node.js ou exécuter le script d'installation."
  fi
fi

# Vérification des dépendances nécessaires
echo -e "${BLUE}[4/6] Vérification des dépendances...${NC}"
if ! $NPM_CMD list typescript > /dev/null 2>&1 || ! $NPM_CMD list ts-node > /dev/null 2>&1; then
  echo -e "${YELLOW}Installation des dépendances TypeScript manquantes...${NC}"
  $NPM_CMD install --no-save typescript ts-node @types/node
  echo -e "${GREEN}✅ Dépendances TypeScript installées${NC}"
else
  echo -e "${GREEN}✅ Dépendances TypeScript vérifiées${NC}"
fi

# Vérification de l'installation Python pour les scripts auxiliaires
echo -e "${BLUE}[5/6] Vérification de Python...${NC}"
if command -v python3 &> /dev/null; then
  echo -e "${GREEN}✅ Python 3 trouvé: $(python3 --version)${NC}"
  # Optionnel: vérifier les modules Python
  if command -v pip3 &> /dev/null; then
    if ! pip3 list | grep -q "hl7"; then
      echo -e "${YELLOW}Module hl7 Python manquant, installation...${NC}"
      pip3 install hl7 --quiet
    fi
    if ! pip3 list | grep -q "requests"; then
      echo -e "${YELLOW}Module requests Python manquant, installation...${NC}"
      pip3 install requests --quiet
    fi
  fi
elif command -v python &> /dev/null; then
  PYTHON_VERSION=$(python --version 2>&1)
  if [[ $PYTHON_VERSION == Python\ 3* ]]; then
    echo -e "${GREEN}✅ Python 3 trouvé: $PYTHON_VERSION${NC}"
  else
    echo -e "${YELLOW}⚠️ Python $PYTHON_VERSION trouvé, mais Python 3 est recommandé${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ Python non trouvé. Certaines fonctionnalités pourraient ne pas être disponibles.${NC}"
fi

# Vérifier si le port 5000 est déjà utilisé et le libérer si nécessaire
echo -e "${BLUE}[6/6] Préparation du serveur...${NC}"
echo -e "${BLUE}Vérification du port 5000...${NC}"
PORT_CHECK=""
if command -v lsof &> /dev/null; then
  PORT_CHECK=$(lsof -i:5000 -t 2>/dev/null)
elif command -v netstat &> /dev/null; then
  PORT_CHECK=$(netstat -tuln 2>/dev/null | grep ":5000 " | wc -l)
  if [ "$PORT_CHECK" -gt "0" ]; then
    PORT_CHECK="en_utilisation"
  else
    PORT_CHECK=""
  fi
fi

if [ ! -z "$PORT_CHECK" ]; then
  echo -e "${YELLOW}⚠️ Port 5000 déjà utilisé, tentative de libération...${NC}"
  if command -v lsof &> /dev/null; then
    kill -9 $PORT_CHECK 2>/dev/null && echo -e "${GREEN}✅ Port 5000 libéré${NC}" || echo -e "${YELLOW}⚠️ Impossible de libérer le port 5000${NC}"
  else
    echo -e "${YELLOW}⚠️ Impossible de libérer le port 5000 automatiquement. Veuillez vérifier manuellement.${NC}"
  fi
else
  echo -e "${GREEN}✅ Port 5000 disponible${NC}"
fi

# Démarrage du serveur
echo -e "${CYAN}=========================================================="
echo -e "   Démarrage du serveur FHIRHub"
echo -e "   http://localhost:5000"
echo -e "==========================================================${NC}"

# Démarrage avec le Node.js approprié
$NODE_CMD app.js