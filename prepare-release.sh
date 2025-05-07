#!/bin/bash

# Script de préparation de release pour FHIRHub
# Ce script prépare le projet pour une release de production

echo "=========================================================="
echo "         Préparation de la release FHIRHub"
echo "=========================================================="

# Vérification de Git
if ! command -v git &> /dev/null; then
  echo "ERREUR: Git n'est pas installé. Veuillez installer Git avant de continuer."
  exit 1
fi

# Vérification de Node.js
if ! command -v node &> /dev/null; then
  echo "ERREUR: Node.js n'est pas installé. Veuillez installer Node.js v18+ avant de continuer."
  exit 1
fi

# Vérification qu'on est dans un dépôt Git
if [ ! -d ".git" ]; then
  echo "ERREUR: Ce dossier n'est pas un dépôt Git."
  echo "Veuillez exécuter ce script à partir de la racine du dépôt Git FHIRHub."
  exit 1
fi

# Vérification que package.json existe
if [ ! -f "package.json" ]; then
  echo "ERREUR: Fichier package.json introuvable."
  echo "Veuillez exécuter ce script à partir de la racine du projet FHIRHub."
  exit 1
fi

# Lecture de la version actuelle depuis package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Version actuelle: $CURRENT_VERSION"

# Demande de la nouvelle version
echo "Entrez la nouvelle version (au format x.y.z):"
read NEW_VERSION

# Validation du format de version
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERREUR: Format de version invalide. Utilisez le format x.y.z (ex: 1.2.0)"
  exit 1
fi

# Mise à jour du package.json
echo "Mise à jour de la version dans package.json..."
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json

# Vérification des modifications non commitées
if [ -n "$(git status --porcelain)" ]; then
  echo "ATTENTION: Il y a des modifications non commitées dans votre dépôt."
  echo "Ces modifications seront incluses dans la release."
  
  read -p "Voulez-vous continuer? (o/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Préparation de release annulée."
    # Restaurer la version originale
    sed -i "s/\"version\": \"$NEW_VERSION\"/\"version\": \"$CURRENT_VERSION\"/" package.json
    exit 0
  fi
fi

# Nettoyage des fichiers temporaires
echo "Nettoyage des fichiers temporaires..."
rm -rf node_modules
rm -rf logs/*.log
rm -rf data/temp/*
rm -rf data/cache/*

# Restauration des dépendances proprement
echo "Installation des dépendances de production..."
npm ci --production

# Création d'un dossier release
RELEASE_DIR="release_${NEW_VERSION}"
echo "Préparation du dossier de release: $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copie des fichiers essentiels
echo "Copie des fichiers dans le dossier de release..."
cp -r app.js server.js hl7Parser.js hl7ToFhirAdvancedConverter.js package.json package-lock.json "$RELEASE_DIR/"
cp -r README.md LICENSE french_terminology_adapter.js swagger.js "$RELEASE_DIR/"
cp -r api middleware routes src utils french_terminology public docs "$RELEASE_DIR/"
cp -r install.sh install.bat start.sh start.bat install-service.sh install-service.bat "$RELEASE_DIR/"

# Création des dossiers de données
mkdir -p "$RELEASE_DIR/data"
mkdir -p "$RELEASE_DIR/data/cache"
mkdir -p "$RELEASE_DIR/data/conversions"
mkdir -p "$RELEASE_DIR/data/history"
mkdir -p "$RELEASE_DIR/data/outputs"
mkdir -p "$RELEASE_DIR/data/test"
mkdir -p "$RELEASE_DIR/logs"
mkdir -p "$RELEASE_DIR/backups"

# Création d'un fichier .env de production
echo "Création du fichier .env de production..."
cat > "$RELEASE_DIR/.env" << EOF
# Configuration FHIRHub Production
NODE_ENV=production
PORT=5000
DB_PATH=./data/fhirhub.db
LOG_LEVEL=info
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Préparation des terminologies françaises par défaut
if [ -d "french_terminology" ]; then
  echo "Copie des terminologies françaises..."
  cp -r french_terminology "$RELEASE_DIR/"
fi

# Création d'un fichier CHANGELOG.md si nécessaire
if [ ! -f "CHANGELOG.md" ]; then
  echo "Création d'un fichier CHANGELOG.md..."
  cat > "$RELEASE_DIR/CHANGELOG.md" << EOF
# Journal des modifications

## v${NEW_VERSION} - $(date +%Y-%m-%d)

### Ajouts
- Première release officielle de FHIRHub
- Conversion complète de messages HL7 v2.5 vers FHIR R4
- Support des terminologies françaises (ANS)
- Interface utilisateur intuitive
- API REST sécurisée
- Système de cache intelligent

### Modifications
- N/A

### Corrections
- N/A
EOF
else
  cp CHANGELOG.md "$RELEASE_DIR/"
fi

# Création d'un fichier README.release.md
cat > "$RELEASE_DIR/README.release.md" << EOF
# FHIRHub v${NEW_VERSION} - Release Notes

Cette archive contient la version ${NEW_VERSION} de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4.

## Installation rapide

### Linux/macOS
\`\`\`bash
# Donner les permissions d'exécution aux scripts
chmod +x install.sh start.sh install-service.sh

# Installer l'application
./install.sh

# Démarrer l'application
./start.sh
\`\`\`

### Windows
\`\`\`
# Installer l'application
install.bat

# Démarrer l'application
start.bat
\`\`\`

## Installation comme service système

### Linux
\`\`\`bash
sudo ./install-service.sh
\`\`\`

### Windows
Exécutez \`install-service.bat\` en tant qu'administrateur.

## Accès à l'application

L'application sera accessible à l'adresse: http://localhost:5000

Identifiants par défaut:
- Utilisateur: admin
- Mot de passe: admin123

## Documentation

Consultez le fichier README.md pour plus d'informations.
EOF

# Création d'une archive ZIP
echo "Création de l'archive ZIP..."
zip -r "FHIRHub-${NEW_VERSION}.zip" "$RELEASE_DIR"

# Nettoyage
echo "Nettoyage..."
rm -rf "$RELEASE_DIR"

# Commit des changements
echo "Commit des changements dans Git..."
git add package.json
git commit -m "Préparation de la release v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Version ${NEW_VERSION}"

echo "=========================================================="
echo "Release v${NEW_VERSION} préparée avec succès!"
echo "Archive créée: FHIRHub-${NEW_VERSION}.zip"
echo "Tag Git créé: v${NEW_VERSION}"
echo ""
echo "Pour pousser le tag vers le dépôt distant, exécutez:"
echo "  git push origin v${NEW_VERSION}"
echo ""
echo "Pour restaurer votre environnement de développement, exécutez:"
echo "  npm install"
echo "=========================================================="