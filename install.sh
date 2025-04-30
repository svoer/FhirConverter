#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installation de FHIRHub...${NC}"

# Vérifier la version de Node.js
NODE_VERSION=$(node -v)
echo -e "Version de Node.js détectée : ${GREEN}$NODE_VERSION${NC}"

# Vérifier si la variable d'environnement pour ignorer la vérification de version est définie
if [ -n "$SKIP_NODE_VERSION_CHECK" ]; then
    echo -e "${YELLOW}Vérification de version de Node.js ignorée (SKIP_NODE_VERSION_CHECK définie)${NC}"
# Vérifier si la version de Node est compatible (v16-v20)
elif [[ $NODE_VERSION =~ ^v2[2-9] ]]; then
    echo -e "${RED}La version de Node.js est trop récente (v22+) et peut causer des problèmes avec better-sqlite3.${NC}"
    echo -e "${YELLOW}Installation de Node.js v20 recommandée...${NC}"
    
    # Vérifier si nvm est disponible
    if command -v nvm &> /dev/null; then
        echo -e "Utilisation de nvm pour installer Node.js v20..."
        nvm install 20
        nvm use 20
    # Vérifier si fnm est disponible
    elif command -v fnm &> /dev/null; then
        echo -e "Utilisation de fnm pour installer Node.js v20..."
        fnm install 20
        fnm use 20
    else
        echo -e "${RED}Veuillez installer Node.js v20 manuellement et relancer ce script.${NC}"
        echo -e "Vous pouvez installer fnm ou nvm, ou télécharger Node.js depuis https://nodejs.org/"
        exit 1
    fi
    
    # Vérifier à nouveau la version après changement
    NODE_VERSION=$(node -v)
    echo -e "Nouvelle version de Node.js : ${GREEN}$NODE_VERSION${NC}"
fi

# Supprimer node_modules et package-lock.json pour une installation propre
echo -e "${YELLOW}Suppression des modules précédents...${NC}"
rm -rf node_modules package-lock.json

# Installer les dépendances
echo -e "${YELLOW}Installation des dépendances...${NC}"
npm install

# Vérifier si les modules HL7 sont installés
echo -e "${YELLOW}Vérification des modules HL7...${NC}"
if ! npm list hl7 &> /dev/null || ! npm list simple-hl7 &> /dev/null || ! npm list hl7-standard &> /dev/null; then
    echo -e "${YELLOW}Installation des modules HL7 manquants...${NC}"
    npm install hl7 simple-hl7 hl7-standard hl7-parser --save
fi

# Vérifier si l'installation a réussi
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Installation réussie!${NC}"
    echo -e "${YELLOW}Création des dossiers requis...${NC}"
    
    # Créer les dossiers nécessaires
    mkdir -p data/conversions data/outputs data/history data/test
    
    # Si le fichier de correction existe, l'exécuter
    if [ -f "fix_converters.sh" ]; then
        echo -e "${YELLOW}Application des corrections de modules...${NC}"
        bash fix_converters.sh
    fi
    
    echo -e "${GREEN}FHIRHub est prêt à être utilisé.${NC}"
    echo -e "Pour démarrer l'application, exécutez: ${YELLOW}bash start.sh${NC}"
else
    echo -e "${RED}L'installation a échoué.${NC}"
    echo -e "Veuillez consulter les messages d'erreur ci-dessus pour plus d'informations."
    exit 1
fi