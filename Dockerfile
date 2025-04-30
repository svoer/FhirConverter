# Utiliser Node.js 20 (ne pas utiliser Node.js 22+ à cause de problèmes de compilation avec better-sqlite3)
FROM node:20-alpine

# Installation des dépendances système
RUN apk add --no-cache python3 py3-requests bash curl

WORKDIR /app

# Copie des fichiers package.json et package-lock.json
COPY package*.json ./

# Installation des dépendances Node.js avec les modules HL7 explicitement inclus
RUN npm install && \
    npm install hl7 simple-hl7 hl7-standard hl7-parser --save

# Copie du reste des fichiers du projet
COPY . .

# Création des dossiers de données requis
RUN mkdir -p data/conversions data/outputs data/history data/test \
    src/converters src/terminology src/utils src/services

# Exposition du port
EXPOSE 5000

# Commande de démarrage
CMD ["node", "app.js"]