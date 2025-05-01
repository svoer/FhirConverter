#!/bin/bash

# Script d'installation de Node.js v20 pour FHIRHub
# Ce script peut être exécuté avec ou sans privilèges root

echo "=========================================================="
echo "     Installation de Node.js v20 pour FHIRHub"
echo "=========================================================="

# Définition de la version de Node.js à installer
NODE_VERSION="20.15.1"
NODE_VERSION_MAJOR="20"

# Fonction pour vérifier la présence de Node.js
check_node() {
  if command -v node &> /dev/null; then
    local version=$(node -v | cut -c 2-)
    echo "Node.js $version est déjà installé."
    return 0
  else
    echo "Node.js n'est pas trouvé dans le PATH."
    return 1
  fi
}

# Fonction pour installer Node.js dans le répertoire local
install_nodejs_local() {
  echo "Installation de Node.js v${NODE_VERSION} dans le répertoire local..."
  
  # Déterminer l'architecture du système
  ARCH=$(uname -m)
  case "$ARCH" in
    "x86_64")
      NODEJS_ARCH="x64"
      ;;
    "aarch64"|"arm64")
      NODEJS_ARCH="arm64"
      ;;
    "armv7l")
      NODEJS_ARCH="armv7l"
      ;;
    *)
      echo "Architecture $ARCH non supportée pour l'installation locale."
      return 1
      ;;
  esac
  
  # Déterminer le système d'exploitation
  OS=$(uname -s)
  case "$OS" in
    "Linux")
      NODEJS_OS="linux"
      ;;
    "Darwin")
      NODEJS_OS="darwin"
      ;;
    *)
      echo "Système d'exploitation $OS non supporté pour l'installation locale."
      return 1
      ;;
  esac
  
  # Créer le répertoire pour l'installation locale
  INSTALL_DIR="$(pwd)/.node"
  mkdir -p "$INSTALL_DIR"
  
  # Télécharger et extraire Node.js
  DOWNLOAD_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODEJS_OS}-${NODEJS_ARCH}.tar.gz"
  TEMP_TAR="/tmp/nodejs-${NODE_VERSION}.tar.gz"
  
  echo "Téléchargement de Node.js depuis $DOWNLOAD_URL"
  curl -L -o "$TEMP_TAR" "$DOWNLOAD_URL"
  
  if [ ! -f "$TEMP_TAR" ]; then
    echo "Échec du téléchargement de Node.js."
    return 1
  fi
  
  echo "Extraction de Node.js dans $INSTALL_DIR"
  tar -xzf "$TEMP_TAR" -C "$INSTALL_DIR" --strip-components=1
  rm "$TEMP_TAR"
  
  # Créer fichier .nodejsrc pour le chargement des variables d'environnement
  cat > .nodejsrc << EOF
# Configuration de Node.js local pour FHIRHub
USE_LOCAL_NODEJS=1
NODE_PATH="$(pwd)/.node/bin"
PATH="$(pwd)/.node/bin:$PATH"
EOF
  
  echo "Node.js v${NODE_VERSION} installé avec succès dans $INSTALL_DIR"
  echo "Configuration enregistrée dans .nodejsrc"
  echo ""
  echo "Pour utiliser ce Node.js, chargez le fichier .nodejsrc:"
  echo "  source ./.nodejsrc"
  echo ""
  echo "Ou utilisez directement le binaire:"
  echo "  $(pwd)/.node/bin/node"
  
  # Charger les variables pour la session actuelle
  export USE_LOCAL_NODEJS=1
  export NODE_PATH="$(pwd)/.node/bin"
  export PATH="$(pwd)/.node/bin:$PATH"
  
  return 0
}

# Fonction pour installer Node.js via le gestionnaire de paquets (nécessite root)
install_nodejs_system() {
  echo "Installation de Node.js v${NODE_VERSION_MAJOR} via le gestionnaire de paquets..."
  
  if [ "$EUID" -ne 0 ]; then
    echo "Cette méthode nécessite les privilèges root. Veuillez exécuter avec sudo."
    return 1
  fi
  
  # Détecter le gestionnaire de paquets
  if command -v apt-get &> /dev/null; then
    echo "Utilisation de apt..."
    # Ajouter le dépôt Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION_MAJOR}.x | bash -
    apt-get install -y nodejs
  elif command -v dnf &> /dev/null; then
    echo "Utilisation de dnf..."
    dnf module reset -y nodejs
    dnf module install -y nodejs:${NODE_VERSION_MAJOR}/default
  elif command -v yum &> /dev/null; then
    echo "Utilisation de yum..."
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION_MAJOR}.x | bash -
    yum install -y nodejs
  else
    echo "Aucun gestionnaire de paquets supporté n'a été trouvé."
    return 1
  fi
  
  # Vérifier si l'installation a réussi
  if command -v node &> /dev/null; then
    echo "Node.js $(node -v) a été installé avec succès."
    return 0
  else
    echo "L'installation de Node.js a échoué."
    return 1
  fi
}

# Vérifier si Node.js est déjà installé
if check_node; then
  # Si Node.js est déjà installé, vérifier la version
  CURRENT_VERSION=$(node -v | cut -c 2-)
  CURRENT_VERSION_MAJOR=$(echo $CURRENT_VERSION | cut -d '.' -f 1)
  
  if [ "$CURRENT_VERSION_MAJOR" -ge "$NODE_VERSION_MAJOR" ]; then
    echo "La version actuelle de Node.js est compatible avec FHIRHub."
    echo "Aucune action requise."
    exit 0
  else
    echo "La version actuelle de Node.js ($CURRENT_VERSION) est inférieure à la version recommandée (v${NODE_VERSION_MAJOR}.x)."
    echo ""
    echo "Options disponibles:"
    echo "1) Continuer avec la version actuelle (non recommandé)"
    echo "2) Installer Node.js v${NODE_VERSION} localement (ne nécessite pas root)"
    echo "3) Installer Node.js v${NODE_VERSION_MAJOR} via le gestionnaire de paquets (nécessite root)"
    echo ""
    read -p "Choisissez une option (1-3): " option
    
    case "$option" in
      1)
        echo "Utilisation de la version actuelle de Node.js."
        exit 0
        ;;
      2)
        if install_nodejs_local; then
          exit 0
        else
          echo "L'installation locale a échoué."
          exit 1
        fi
        ;;
      3)
        if install_nodejs_system; then
          exit 0
        else
          echo "L'installation système a échoué."
          exit 1
        fi
        ;;
      *)
        echo "Option invalide."
        exit 1
        ;;
    esac
  fi
else
  # Si Node.js n'est pas installé, proposer les méthodes d'installation
  echo "Node.js n'est pas installé."
  echo ""
  echo "Options disponibles:"
  echo "1) Installer Node.js v${NODE_VERSION} localement (ne nécessite pas root)"
  echo "2) Installer Node.js v${NODE_VERSION_MAJOR} via le gestionnaire de paquets (nécessite root)"
  echo ""
  read -p "Choisissez une option (1-2): " option
  
  case "$option" in
    1)
      if install_nodejs_local; then
        exit 0
      else
        echo "L'installation locale a échoué."
        exit 1
      fi
      ;;
    2)
      if install_nodejs_system; then
        exit 0
      else
        echo "L'installation système a échoué."
        exit 1
      fi
      ;;
    *)
      echo "Option invalide."
      exit 1
      ;;
  esac
fi