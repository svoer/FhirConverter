# Utiliser Node.js 20 (ne pas utiliser Node.js 22+ à cause de problèmes de compilation avec better-sqlite3)
FROM node:20-alpine

# Installation des dépendances Python pour les scripts de mise à jour des terminologies
RUN apk add --no-cache python3 py3-pip bash
RUN pip3 install requests

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

# Commande de démarrage
CMD ["bash", "start.sh"]