#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Déploiement simplifié de FHIRHub...${NC}"

# Vérifier si Docker est installé
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}Docker détecté. Déploiement en mode conteneur...${NC}"
    
    # Vérifier que tous les répertoires nécessaires existent
    echo -e "${YELLOW}Vérification de la structure de répertoires...${NC}"
    mkdir -p src/converters src/terminology src/utils src/services data/conversions data/outputs data/history data/test
    
    # Vérifier si les fichiers de convertisseur existent avec la bonne casse
    if [ ! -f "src/converters/hl7ToFhirConverter.js" ]; then
        echo -e "${RED}Erreur: Le fichier src/converters/hl7ToFhirConverter.js est manquant.${NC}"
        echo -e "${YELLOW}Veuillez vérifier que ce fichier existe dans le bon répertoire.${NC}"
        exit 1
    fi
    
    # S'assurer que la version en majuscule existe aussi pour compatibilité
    if [ ! -f "src/converters/HL7ToFHIRConverter.js" ]; then
        echo -e "${YELLOW}Création du fichier adaptateur pour HL7ToFHIRConverter.js...${NC}"
        cat > src/converters/HL7ToFHIRConverter.js << 'EOF'
/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * Résout les problèmes de casse dans les imports
 */

// Importer le vrai convertisseur (avec une casse cohérente)
const converter = require('./hl7ToFhirConverter');

// Exporter toutes les fonctions du convertisseur
module.exports = converter;
EOF
        echo -e "${GREEN}Fichier adaptateur créé.${NC}"
    fi
    
    # Construction et démarrage du conteneur
    echo -e "${YELLOW}Construction et démarrage du conteneur...${NC}"
    docker-compose down
    docker-compose up --build -d
    
    # Vérifier si le déploiement a réussi
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Déploiement réussi!${NC}"
        echo -e "FHIRHub est disponible à l'adresse: ${YELLOW}http://localhost:5000${NC}"
        echo -e "Pour voir les logs: ${YELLOW}docker-compose logs -f${NC}"
    else
        echo -e "${RED}Échec du déploiement Docker.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Docker non détecté. Déploiement en mode standard...${NC}"
    
    # Vérification de Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Erreur: Node.js n'est pas installé.${NC}"
        echo -e "${YELLOW}Veuillez installer Node.js v20 avant de continuer.${NC}"
        exit 1
    fi
    
    # Installation des dépendances
    echo -e "${YELLOW}Installation des dépendances...${NC}"
    npm install
    
    # Vérifier si les modules HL7 sont installés
    if ! npm list hl7 &> /dev/null; then
        echo -e "${YELLOW}Installation des modules HL7 manquants...${NC}"
        npm install hl7 simple-hl7 hl7-standard hl7-parser --save
    fi
    
    # Création des répertoires nécessaires
    echo -e "${YELLOW}Création des répertoires nécessaires...${NC}"
    mkdir -p src/converters src/terminology src/utils src/services data/conversions data/outputs data/history data/test
    
    # Vérifier si les fichiers de convertisseur existent avec la bonne casse
    if [ ! -f "src/converters/hl7ToFhirConverter.js" ]; then
        echo -e "${RED}Erreur: Le fichier src/converters/hl7ToFhirConverter.js est manquant.${NC}"
        echo -e "${YELLOW}Veuillez vérifier que ce fichier existe dans le bon répertoire.${NC}"
        exit 1
    fi
    
    # S'assurer que la version en majuscule existe aussi pour compatibilité
    if [ ! -f "src/converters/HL7ToFHIRConverter.js" ]; then
        echo -e "${YELLOW}Création du fichier adaptateur pour HL7ToFHIRConverter.js...${NC}"
        cat > src/converters/HL7ToFHIRConverter.js << 'EOF'
/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * Résout les problèmes de casse dans les imports
 */

// Importer le vrai convertisseur (avec une casse cohérente)
const converter = require('./hl7ToFhirConverter');

// Exporter toutes les fonctions du convertisseur
module.exports = converter;
EOF
        echo -e "${GREEN}Fichier adaptateur créé.${NC}"
    fi
    
    # Démarrage de l'application
    echo -e "${GREEN}Démarrage de l'application...${NC}"
    node app.js
fi