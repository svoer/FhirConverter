#!/bin/bash

# Script pour corriger les permissions dans les volumes Docker
# À exécuter en cas de problèmes avec les compteurs ou les statistiques

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Correction des permissions pour FHIRHub Docker ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si les conteneurs sont en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${RED}Erreur: Conteneur FHIRHub non trouvé. Veuillez démarrer les conteneurs.${NC}"
  exit 1
fi

echo -e "${YELLOW}Arrêt des conteneurs...${NC}"
docker-compose down

echo -e "${YELLOW}Correction des permissions des volumes...${NC}"
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology

# Permissions pour les conteneurs Docker
echo -e "${YELLOW}Configuration des permissions correctes pour les conteneurs Docker...${NC}"

# Droits pour Prometheus (utilisateur 1000:1000)
mkdir -p ./volumes/prometheus
chown -R 1000:1000 ./volumes/prometheus
chmod -R 777 ./volumes/prometheus
echo -e "${GREEN}✓ Permissions Prometheus corrigées${NC}"

# Droits pour Grafana (utilisateur 1000:1000)
mkdir -p ./volumes/grafana
chown -R 1000:1000 ./volumes/grafana
chmod -R 777 ./volumes/grafana
echo -e "${GREEN}✓ Permissions Grafana corrigées${NC}"

# Droits pour FHIRHub (utilisateur root:root)
# Note: Si vous utilisez un autre utilisateur dans votre Dockerfile, ajustez en conséquence
chown -R root:root ./volumes/db
chmod -R 755 ./volumes/db
echo -e "${GREEN}✓ Permissions base de données SQLite corrigées${NC}"

chown -R root:root ./volumes/data
chmod -R 755 ./volumes/data
find volumes/data -type f -exec chmod 644 {} \;
echo -e "${GREEN}✓ Permissions données corrigées${NC}"

chown -R root:root ./volumes/logs
chmod -R 755 ./volumes/logs
find volumes/logs -type f -exec chmod 644 {} \;
echo -e "${GREEN}✓ Permissions logs corrigées${NC}"

chown -R root:root ./volumes/backups
chmod -R 755 ./volumes/backups
echo -e "${GREEN}✓ Permissions sauvegardes corrigées${NC}"

chown -R root:root ./volumes/french_terminology
chmod -R 755 ./volumes/french_terminology
echo -e "${GREEN}✓ Permissions terminologies françaises corrigées${NC}"

# Vérifier si des permissions spéciales sont nécessaires pour certains fichiers
find ./volumes/db -type f -name "*.db" -exec chmod 666 {} \;
find ./volumes/db -type f -name "*.db-*" -exec chmod 666 {} \;
echo -e "${GREEN}✓ Permissions spéciales appliquées${NC}"

echo -e "${YELLOW}Redémarrage des conteneurs...${NC}"
docker-compose up -d

echo -e "${BLUE}Attente du démarrage complet des services...${NC}"
sleep 10

echo -e "${YELLOW}Vérification de l'état des services...${NC}"
docker-compose ps

echo -e "${GREEN}Correction des permissions terminée !${NC}"
echo -e "${BLUE}Problèmes résolus :${NC}"
echo -e "  - Compteurs d'historique qui ne s'incrémentent pas"
echo -e "  - Erreur lors de la réinitialisation des statistiques"
echo -e "  - Problèmes avec l'application par défaut"
echo -e ""
echo -e "${YELLOW}Note: Si vous rencontrez toujours des problèmes, vous pouvez essayer:${NC}"
echo -e "  - Supprimer le fichier de base de données SQLite (volumes/db/fhirhub.db)"
echo -e "  - Redémarrer les conteneurs avec 'docker-compose down && docker-compose up -d'"