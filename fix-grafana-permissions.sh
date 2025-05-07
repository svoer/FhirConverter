#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}    Correction des permissions Grafana/Prometheus${NC}"
echo -e "${BLUE}===============================================${NC}"

# Vérifie si l'utilisateur est root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}⚠️ Ce script doit être exécuté avec les privilèges administrateur (sudo)${NC}"
  echo -e "${YELLOW}Essai de la commande: sudo $0${NC}"
  exit 1
fi

# Créer les répertoires nécessaires
echo -e "${YELLOW}Création des répertoires s'ils n'existent pas...${NC}"
mkdir -p ./volumes/grafana
mkdir -p ./volumes/prometheus
mkdir -p ./prometheus

# Définir les permissions maximales
echo -e "${YELLOW}Configuration des permissions correctes...${NC}"

# Droits pour Prometheus (permissions maximales pour le debug)
chmod -R 777 ./volumes/prometheus
chmod -R 777 ./prometheus
echo -e "${GREEN}✓ Permissions Prometheus corrigées${NC}"

# Droits pour Grafana (permissions maximales pour le debug)
chmod -R 777 ./volumes/grafana
echo -e "${GREEN}✓ Permissions Grafana corrigées${NC}"

# Vérification de l'existence du fichier prometheus.yml
if [ ! -f "./prometheus/prometheus.yml" ]; then
  echo -e "${YELLOW}Création d'un fichier prometheus.yml de base...${NC}"
  cat > ./prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'fhirhub'
    static_configs:
      - targets: ['fhirhub:9091']
EOF
  echo -e "${GREEN}✓ Fichier prometheus.yml créé${NC}"
fi

echo -e "${YELLOW}Redémarrage du service Docker...${NC}"
docker-compose down 
sleep 5
docker-compose up -d

echo -e "${GREEN}✓ Correction des permissions terminée !${NC}"
echo -e "${YELLOW}Note: Vous pouvez maintenant accéder à:${NC}"
echo -e "  - Grafana: http://localhost:3000 (admin/admin123)"
echo -e "  - Prometheus: http://localhost:9092"
echo -e "${BLUE}Pour les problèmes persistants, essayez:${NC}"
echo -e "  - docker-compose down && docker volume prune -f && docker-compose up -d"