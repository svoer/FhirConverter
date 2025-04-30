#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Correction des problèmes de modules...${NC}"

# Vérifier si les fichiers de convertisseur existent
if [ -f "src/converters/hl7ToFhirConverter.js" ] && [ -f "src/converters/HL7ToFHIRConverter.js" ]; then
    echo -e "${YELLOW}Problème détecté : Deux fichiers de convertisseur avec des casses différentes${NC}"
    
    # Créer des liens symboliques pour résoudre les problèmes de casse
    echo -e "Création d'un lien symbolique pour uniformiser les noms de fichiers..."
    
    # Créer ou remplacer le fichier HL7ToFHIRConverter.js pour qu'il utilise hl7ToFhirConverter.js
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

    echo -e "${GREEN}Lien créé avec succès.${NC}"
elif [ ! -f "src/converters/hl7ToFhirConverter.js" ] && [ ! -f "src/converters/HL7ToFHIRConverter.js" ]; then
    echo -e "${RED}Erreur : Aucun fichier de convertisseur trouvé.${NC}"
    exit 1
fi

# Vérifier si le fichier src/index.js existe
if [ -f "src/index.js" ]; then
    echo -e "${YELLOW}Mise à jour de src/index.js pour garantir des imports corrects...${NC}"
    
    # Remplacer les imports par des versions robustes
    sed -i 's/require(.\/converters\/HL7ToFHIRConverter)/require(".\/converters\/HL7ToFHIRConverter")/' src/index.js
    
    echo -e "${GREEN}src/index.js mis à jour.${NC}"
else
    echo -e "${RED}Erreur : src/index.js non trouvé.${NC}"
    exit 1
fi

echo -e "${GREEN}Corrections terminées. Essayez maintenant de redémarrer l'application avec 'bash start.sh'${NC}"