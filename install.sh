#!/bin/bash

# Script d'installation pour l'application FHIRHub
# Convertisseur HL7 v2.5 vers FHIR R4 avec terminologies françaises
# Version 1.2.0

echo "=========================================================="
echo "     Installation de FHIRHub - Convertisseur HL7 vers FHIR"
echo "     Version 1.2.0 - ANS Compatible"
echo "=========================================================="

# Définir les variables pour Node.js intégré
NODE_VERSION="20.15.1"
NODE_DIR="node-v${NODE_VERSION}-linux-x64"
NODE_ARCHIVE="${NODE_DIR}.tar.gz"
NODE_URL="https://nodejs.org/download/release/v${NODE_VERSION}/${NODE_ARCHIVE}"
NODE_LOCAL_PATH="./vendor/nodejs"

# Créer le répertoire vendor s'il n'existe pas
mkdir -p ./vendor

# Vérification de l'environnement
echo "[1/7] Vérification de l'environnement..."

# Fonction pour télécharger et installer Node.js localement
install_local_nodejs() {
  echo "📦 Installation locale de Node.js v${NODE_VERSION}..."
  
  # Vérifier si l'archive existe déjà
  if [ ! -f "./vendor/${NODE_ARCHIVE}" ]; then
    echo "   Téléchargement de Node.js v${NODE_VERSION}..."
    
    # Vérifier si curl ou wget est disponible
    if command -v curl &> /dev/null; then
      curl -L -o "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --progress-bar
    elif command -v wget &> /dev/null; then
      wget -O "./vendor/${NODE_ARCHIVE}" "${NODE_URL}" --show-progress
    else
      echo "❌ Ni curl ni wget n'est installé. Impossible de télécharger Node.js."
      echo "   Veuillez installer curl ou wget, ou installer Node.js manuellement."
      exit 1
    fi
    
    if [ $? -ne 0 ]; then
      echo "❌ Échec du téléchargement de Node.js."
      exit 1
    fi
  else
    echo "   Archive Node.js déjà téléchargée."
  fi
  
  # Extraire l'archive si le répertoire n'existe pas
  if [ ! -d "${NODE_LOCAL_PATH}" ]; then
    echo "   Extraction de Node.js..."
    mkdir -p "${NODE_LOCAL_PATH}"
    tar -xzf "./vendor/${NODE_ARCHIVE}" -C "./vendor/"
    mv "./vendor/${NODE_DIR}"/* "${NODE_LOCAL_PATH}/"
    rm -rf "./vendor/${NODE_DIR}"
    
    if [ $? -ne 0 ]; then
      echo "❌ Échec de l'extraction de Node.js."
      exit 1
    fi
  else
    echo "   Node.js déjà extrait."
  fi
  
  echo "✅ Node.js v${NODE_VERSION} installé localement avec succès."
  
  # Exporter les variables d'environnement pour utiliser la version locale
  export PATH="${PWD}/${NODE_LOCAL_PATH}/bin:$PATH"
  export USE_LOCAL_NODEJS=1
  
  # Vérifier l'installation
  if ! command -v "${PWD}/${NODE_LOCAL_PATH}/bin/node" &> /dev/null; then
    echo "❌ L'installation locale de Node.js a échoué."
    exit 1
  fi
  
  echo "   Version locale de Node.js utilisée: $("${PWD}/${NODE_LOCAL_PATH}/bin/node" -v)"
}

# Déterminer si Node.js est déjà installé sur le système
use_system_nodejs=false
use_local_nodejs=true

if command -v node &> /dev/null; then
  INSTALLED_NODE_VERSION=$(node -v | cut -d 'v' -f 2)
  MAJOR_VERSION=$(echo $INSTALLED_NODE_VERSION | cut -d '.' -f 1)
  
  if [ "$MAJOR_VERSION" -ge 18 ] && [ "$MAJOR_VERSION" -le 20 ]; then
    echo "✅ Node.js v${INSTALLED_NODE_VERSION} trouvé et compatible."
    echo "   Options disponibles :"
    echo "   1) Utiliser Node.js ${INSTALLED_NODE_VERSION} du système"
    echo "   2) Installer Node.js v${NODE_VERSION} localement (recommandé pour la compatibilité)"
    echo "   Votre choix (1 ou 2) ? "
    read -r choice
    
    if [ "$choice" = "1" ]; then
      use_system_nodejs=true
      use_local_nodejs=false
      echo "   ✓ Utilisation de Node.js $(node -v) du système."
    else
      echo "   ✓ Installation et utilisation de Node.js v${NODE_VERSION} localement..."
      install_local_nodejs
    fi
  else
    echo "⚠️ Node.js v${INSTALLED_NODE_VERSION} détecté, mais non optimal pour FHIRHub."
    echo "   Installation de Node.js v${NODE_VERSION} localement pour assurer la compatibilité..."
    install_local_nodejs
  fi
else
  echo "❓ Node.js non détecté sur le système."
  echo "   Installation de Node.js v${NODE_VERSION} localement..."
  install_local_nodejs
fi

# Modification du script de démarrage pour utiliser le Node.js local
if [ "$use_local_nodejs" = true ]; then
  # Sauvegarder une copie du script de démarrage original si nécessaire
  if [ ! -f "./start.sh.orig" ]; then
    cp ./start.sh ./start.sh.orig
  fi
  
  # Modifier le script de démarrage pour utiliser le Node.js local
  sed -i "s|^node app.js|\"${PWD}/${NODE_LOCAL_PATH}/bin/node\" app.js|g" ./start.sh
  echo "   ✓ Script de démarrage modifié pour utiliser Node.js local."
fi

# Utiliser le Node.js local pour le reste de l'installation si nécessaire
if [ "$use_local_nodejs" = true ]; then
  NODE_CMD="${PWD}/${NODE_LOCAL_PATH}/bin/node"
  NPM_CMD="${PWD}/${NODE_LOCAL_PATH}/bin/npm"
else
  NODE_CMD="node"
  NPM_CMD="npm"
fi

echo "✅ Environnement compatible (Node.js $(${NODE_CMD} -v))"

# Création des répertoires nécessaires
echo "[2/7] Création des répertoires..."
mkdir -p ./data/conversions ./data/history ./data/outputs ./data/test ./logs ./backups
echo "✅ Structure des dossiers de données créée"

# Installation des dépendances
echo "[3/7] Installation des dépendances..."

# Vérifier si Python est disponible
echo "   Vérification de Python..."
if command -v python3 &> /dev/null; then
  PYTHON_CMD="python3"
  echo "   ✅ Python 3 trouvé: $(python3 --version)"
elif command -v python &> /dev/null; then
  PYTHON_VERSION=$(python --version 2>&1)
  if [[ $PYTHON_VERSION == Python\ 3* ]]; then
    PYTHON_CMD="python"
    echo "   ✅ Python 3 trouvé: $PYTHON_VERSION"
  else
    echo "   ⚠️ Python $PYTHON_VERSION trouvé, mais Python 3 est recommandé"
    PYTHON_CMD="python"
  fi
else
  echo "   ⚠️ Python non trouvé. Certaines fonctionnalités pourraient ne pas être disponibles."
  PYTHON_CMD=""
fi

# Installation des modules Python nécessaires si Python est disponible
if [ ! -z "$PYTHON_CMD" ]; then
  echo "   Installation des modules Python requis..."
  
  # Vérifier si pip est disponible
  PIP_CMD=""
  if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
    echo "   ✅ pip3 trouvé"
  elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
    echo "   ✅ pip trouvé"
  else
    echo "   ⚠️ pip non trouvé, tentative d'installation..."
    
    # Tentative d'installation de pip
    if [ "$PYTHON_CMD" = "python3" ]; then
      # Pour les distributions basées sur Debian/Ubuntu
      if command -v apt-get &> /dev/null; then
        echo "   Tentative d'installation de pip avec apt-get..."
        apt-get update -qq && apt-get install -y python3-pip >/dev/null 2>&1
      # Pour les distributions basées sur RHEL/CentOS/Fedora
      elif command -v dnf &> /dev/null; then
        echo "   Tentative d'installation de pip avec dnf..."
        dnf install -y python3-pip >/dev/null 2>&1
      elif command -v yum &> /dev/null; then
        echo "   Tentative d'installation de pip avec yum..."
        yum install -y python3-pip >/dev/null 2>&1
      # Installation manuelle de pip si les gestionnaires de paquets ne sont pas disponibles
      else
        echo "   Tentative d'installation manuelle de pip..."
        curl -s https://bootstrap.pypa.io/get-pip.py -o get-pip.py
        $PYTHON_CMD get-pip.py --quiet
        rm -f get-pip.py
      fi
      
      # Vérifier si l'installation a réussi
      if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
        echo "   ✅ pip3 installé avec succès"
      elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
        echo "   ✅ pip installé avec succès"
      fi
    fi
  fi
  
  # Installation des modules requis si pip est disponible
  if [ ! -z "$PIP_CMD" ]; then
    echo "   Installation des modules hl7 et requests..."
    $PIP_CMD install hl7 requests --quiet
    echo "   ✅ Modules Python installés avec $PIP_CMD"
  else
    echo "   ⚠️ Impossible d'installer pip. Les modules Python requis n'ont pas été installés."
    echo "   Pour installer manuellement, exécutez: $PYTHON_CMD -m pip install hl7 requests"
  fi
fi

# Installation des dépendances Node.js
echo "   Installation des modules Node.js..."
$NPM_CMD install

# Configuration de l'environnement
echo "[4/7] Configuration de l'environnement..."
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
echo "[5/7] Initialisation de la base de données..."
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
echo "[6/7] Finalisation de l'installation..."
chmod +x ./start.sh

# Sauvegarder les informations sur le Node.js utilisé
echo "[7/7] Enregistrement des informations d'environnement..."
if [ "$use_local_nodejs" = true ]; then
  echo "✅ Node.js local intégré: v${NODE_VERSION}"
  cat > ./.nodejsrc << EOF
# FHIRHub Node.js Configuration
NODE_VERSION=${NODE_VERSION}
NODE_PATH=${PWD}/${NODE_LOCAL_PATH}/bin
USE_LOCAL_NODEJS=1
EOF
  echo "✅ Fichier .nodejsrc créé pour utiliser le Node.js intégré"
else
  echo "✅ Node.js système utilisé: $(node -v)"
  cat > ./.nodejsrc << EOF
# FHIRHub Node.js Configuration
NODE_VERSION=$(node -v)
NODE_PATH=
USE_LOCAL_NODEJS=0
EOF
  echo "✅ Fichier .nodejsrc créé pour utiliser le Node.js système"
fi

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