#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Migration de la structure de répertoires de FHIRHub...${NC}"

# Création des répertoires
echo -e "${YELLOW}Création des répertoires standards...${NC}"
mkdir -p api/routes api/controllers api/middleware \
         src/converters src/utils src/services src/terminology src/terminology/french \
         middleware \
         public/css public/js public/img \
         data/conversions data/outputs data/db \
         test/unit test/integration \
         docs

# Vérification de l'existence des fichiers de conversion
if [ ! -f "src/converters/hl7ToFhirConverter.js" ] && [ -f "hl7ToFhirConverter.js" ]; then
    echo -e "${YELLOW}Déplacement de hl7ToFhirConverter.js vers src/converters/...${NC}"
    cp hl7ToFhirConverter.js src/converters/
    echo -e "${GREEN}Fichier déplacé avec succès.${NC}"
fi

if [ ! -f "src/converters/hl7ToFhirConverter.js" ] && [ -f "HL7ToFHIRConverter.js" ]; then
    echo -e "${YELLOW}Déplacement et renommage de HL7ToFHIRConverter.js vers src/converters/hl7ToFhirConverter.js...${NC}"
    cp HL7ToFHIRConverter.js src/converters/hl7ToFhirConverter.js
    echo -e "${GREEN}Fichier déplacé et renommé avec succès.${NC}"
fi

# Création des liens symboliques pour la compatibilité
if [ -f "src/converters/hl7ToFhirConverter.js" ] && [ ! -f "src/converters/HL7ToFHIRConverter.js" ]; then
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

# Vérification des adaptateurs de terminologie française
if [ ! -f "src/terminology/frenchTerminologyAdapter.js" ] && [ -f "french_terminology_adapter.js" ]; then
    echo -e "${YELLOW}Déplacement de french_terminology_adapter.js vers src/terminology/frenchTerminologyAdapter.js...${NC}"
    cp french_terminology_adapter.js src/terminology/frenchTerminologyAdapter.js
    echo -e "${GREEN}Fichier déplacé avec succès.${NC}"
fi

if [ -f "src/terminology/frenchTerminologyAdapter.js" ] && [ ! -f "src/terminology/FrenchTerminologyAdapter.js" ]; then
    echo -e "${YELLOW}Création du fichier adaptateur pour FrenchTerminologyAdapter.js...${NC}"
    cat > src/terminology/FrenchTerminologyAdapter.js << 'EOF'
/**
 * Point d'entrée uniformisé pour l'adaptateur de terminologie française
 * Résout les problèmes de casse dans les imports
 */

// Importer le vrai adaptateur (avec une casse cohérente)
const adapter = require('./frenchTerminologyAdapter');

// Exporter toutes les fonctions de l'adaptateur
module.exports = adapter;
EOF
    echo -e "${GREEN}Fichier adaptateur créé.${NC}"
fi

echo -e "${GREEN}Migration de structure terminée.${NC}"
echo -e "Consultez le fichier README-structure.md pour comprendre l'organisation recommandée."