# Utiliser Node.js 20 (ne pas utiliser Node.js 22+ à cause de problèmes de compilation avec better-sqlite3)
FROM node:20-alpine

# Installation des dépendances Python pour les scripts de mise à jour des terminologies
# Utilisation de py3-requests au lieu de pip install requests pour éviter les erreurs PEP 668
RUN apk add --no-cache python3 py3-pip bash py3-requests

WORKDIR /app

# Copie des fichiers package.json et package-lock.json
COPY package*.json ./

# Installation des dépendances Node.js
RUN npm install

# Copie du reste des fichiers du projet
COPY . .

# Création des dossiers de données requis
RUN mkdir -p data/conversions data/outputs data/history data/test

# Exposition du port
EXPOSE 5000

# Créer des fichiers de compatibilité pour les problèmes de casse
RUN mkdir -p src/converters src/terminology

# S'assurer que les deux versions de casse existent pour les fichiers critiques
RUN if [ -f src/converters/hl7ToFhirConverter.js ] && [ ! -f src/converters/HL7ToFHIRConverter.js ]; then \
    echo "/**\n * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR\n */\nconst converter = require('./hl7ToFhirConverter');\nmodule.exports = converter;" > src/converters/HL7ToFHIRConverter.js; \
    elif [ ! -f src/converters/hl7ToFhirConverter.js ] && [ -f src/converters/HL7ToFHIRConverter.js ]; then \
    echo "/**\n * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR\n */\nconst converter = require('./HL7ToFHIRConverter');\nmodule.exports = converter;" > src/converters/hl7ToFhirConverter.js; \
    fi

# Commande de démarrage
CMD ["bash", "start.sh"]