#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Démarrage de FHIRHub...${NC}"

# Exécuter le script de correction des modules s'il existe
if [ -f "fix_converters.sh" ]; then
    echo -e "${YELLOW}Exécution des corrections automatiques pour les modules...${NC}"
    bash fix_converters.sh
fi

# Vérifier si app.js existe (point d'entrée principal)
if [ -f "app.js" ]; then
    echo -e "${GREEN}Démarrage du serveur via app.js${NC}"
    node app.js
# Vérifier si server.js existe (point d'entrée alternatif)
elif [ -f "server.js" ]; then
    echo -e "${GREEN}Démarrage du serveur via server.js${NC}"
    node server.js
# Vérifier s'il y a un fichier index.js dans le dossier src
elif [ -f "src/index.js" ]; then
    echo -e "${GREEN}Démarrage du serveur via src/index.js${NC}"
    node src/index.js
else
    echo -e "${RED}Erreur: Impossible de trouver le point d'entrée de l'application.${NC}"
    echo -e "Fichiers recherchés: app.js, server.js, src/index.js"
    
    # Si aucun des fichiers principaux n'existe, chercher les fichiers .js à la racine
    JS_FILES=$(find . -maxdepth 1 -name "*.js" | grep -v "node_modules" | sort)
    
    if [ -n "$JS_FILES" ]; then
        echo -e "${YELLOW}Fichiers JavaScript trouvés à la racine:${NC}"
        echo "$JS_FILES"
        echo -e "${YELLOW}Essayez de démarrer l'un de ces fichiers avec 'node nom_fichier.js'${NC}"
    fi
    
    exit 1
fi