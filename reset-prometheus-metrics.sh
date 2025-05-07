#!/bin/bash

# Script pour réinitialiser uniquement les compteurs Prometheus sans affecter les stats FHIRHub

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Réinitialisation des métriques Prometheus pour FHIRHub ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si le conteneur FHIRHub est en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${RED}Erreur: Conteneur FHIRHub non trouvé. Veuillez démarrer les conteneurs.${NC}"
  exit 1
fi

echo -e "${YELLOW}Suppression des métriques Prometheus existantes...${NC}"
docker exec fhirhub-prometheus rm -rf /prometheus/wal/* 2>/dev/null || true
docker exec fhirhub-prometheus rm -rf /prometheus/chunks_head/* 2>/dev/null || true

echo -e "${YELLOW}Redémarrage de Prometheus pour réinitialiser les compteurs...${NC}"
docker restart fhirhub-prometheus

echo -e "${YELLOW}Redémarrage de Grafana pour actualiser les graphiques...${NC}"
docker restart fhirhub-grafana

echo -e "${GREEN}Réinitialisation des métriques Prometheus terminée !${NC}"
echo -e "${BLUE}Les métriques suivantes ont été réinitialisées :${NC}"
echo -e "  - Nombre d'appels API"
echo -e "  - Connexions actives"
echo -e "  - Utilisation CPU (%)"
echo -e "  - Utilisation mémoire (MB)"
echo -e "${YELLOW}Note: Les données de conversion dans la base de données FHIRHub n'ont pas été modifiées.${NC}"