#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Préparation de FHIRHub pour Docker...${NC}"

# Créer le répertoire src/converters s'il n'existe pas
mkdir -p src/converters

# Vérifier si les fichiers existent dans les bons emplacements
if [ ! -f "src/converters/hl7ToFhirConverter.js" ] && [ -f "src/converters/HL7ToFHIRConverter.js" ]; then
    echo -e "${YELLOW}Création du lien pour le convertisseur avec la bonne casse...${NC}"
    cat > src/converters/hl7ToFhirConverter.js << 'EOF'
/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * (Créé par docker_launcher.sh)
 */
const converter = require('./HL7ToFHIRConverter');
module.exports = converter;
EOF
    echo -e "${GREEN}Fichier src/converters/hl7ToFhirConverter.js créé.${NC}"
elif [ -f "src/converters/hl7ToFhirConverter.js" ] && [ ! -f "src/converters/HL7ToFHIRConverter.js" ]; then
    echo -e "${YELLOW}Création du lien pour le convertisseur avec la bonne casse...${NC}"
    cat > src/converters/HL7ToFHIRConverter.js << 'EOF'
/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * (Créé par docker_launcher.sh)
 */
const converter = require('./hl7ToFhirConverter');
module.exports = converter;
EOF
    echo -e "${GREEN}Fichier src/converters/HL7ToFHIRConverter.js créé.${NC}"
fi

# Vérifier que la structure des répertoires est correcte pour la terminologie
mkdir -p src/terminology

# S'assurer que l'adaptateur de terminologie française est disponible
if [ ! -f "src/terminology/FrenchTerminologyAdapter.js" ] && [ -f "french_terminology_adapter.js" ]; then
    echo -e "${YELLOW}Copie de l'adaptateur de terminologie française...${NC}"
    cp french_terminology_adapter.js src/terminology/FrenchTerminologyAdapter.js
    echo -e "${GREEN}Adaptateur de terminologie française copié.${NC}"
fi

# Construire et lancer Docker
echo -e "${YELLOW}Construction et lancement du conteneur Docker...${NC}"
docker-compose down
docker-compose up --build -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Conteneur Docker démarré avec succès !${NC}"
    echo -e "FHIRHub est disponible à l'adresse: ${YELLOW}http://localhost:5000${NC}"
    echo -e "Pour voir les logs: ${YELLOW}docker-compose logs -f${NC}"
else
    echo -e "${RED}Échec du lancement Docker.${NC}"
    echo -e "${YELLOW}Tentative de démarrage en mode standard...${NC}"
    bash start.sh
fi