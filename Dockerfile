FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de configuration du projet
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source et les fichiers nécessaires
COPY . .

# Créer les répertoires nécessaires
RUN mkdir -p data data/conversions data/history data/outputs data/test logs backups

# Exposer le port sur lequel l'application s'exécute
EXPOSE 5000

# Utiliser un utilisateur non-root pour plus de sécurité
RUN addgroup -S fhirhub && adduser -S fhirhub -G fhirhub
RUN chown -R fhirhub:fhirhub /app
USER fhirhub

# Script de démarrage
CMD ["node", "app.js"]