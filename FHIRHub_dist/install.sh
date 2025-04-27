#!/bin/bash

echo "====================================================="
echo "    Installation de FHIRHub - Convertisseur HL7 vers FHIR"
echo "====================================================="

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "Erreur: Node.js n'est pas installé."
    echo "Veuillez installer Node.js (version 18 ou supérieure) avant de continuer."
    echo "https://nodejs.org/fr/download/"
    exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Attention: Version de Node.js trop ancienne ($(node -v))."
    echo "Il est recommandé d'utiliser Node.js 18 ou supérieur."
    read -p "Voulez-vous continuer quand même? (o/N): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[oO]$ ]]; then
        exit 1
    fi
fi

echo "Installation des dépendances..."
npm install

# Créer les répertoires nécessaires s'ils n'existent pas
echo "Création des répertoires de données..."
mkdir -p data/in data/out data/uploads
mkdir -p french_terminology/cache

# Vérifier si la base de données existe déjà
if [ ! -f ./data/fhirhub.db ]; then
    echo "Initialisation de la base de données SQLite..."
    # On utilisera la création automatique à la première exécution
else
    echo "Base de données existante détectée."
fi

# Rendre le script de démarrage exécutable
chmod +x start.sh

echo ""
echo "====================================================="
echo "    Installation terminée avec succès!"
echo "====================================================="
echo ""
echo "Pour démarrer FHIRHub, exécutez la commande:"
echo "    ./start.sh"
echo ""
echo "Puis accédez à l'interface via votre navigateur:"
echo "    http://localhost:5000"
echo ""
echo "Identifiants par défaut:"
echo "    Admin: admin / adminfhirhub"
echo "    User: user / userfhirhub"
echo "====================================================="