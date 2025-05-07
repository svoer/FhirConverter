#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== FHIRHub - Redémarrage des services Docker pour Grafana ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérifier si les conteneurs sont en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${YELLOW}Les conteneurs FHIRHub ne semblent pas être en cours d'exécution.${NC}"
  echo -e "${YELLOW}Voulez-vous démarrer les conteneurs? (o/n)${NC}"
  read -n 1 -r
  echo
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo -e "${YELLOW}Démarrage des conteneurs...${NC}"
    docker-compose up -d
  else
    echo -e "${RED}Opération annulée. Veuillez démarrer les conteneurs manuellement.${NC}"
    exit 1
  fi
fi

echo -e "${YELLOW}Redémarrage du conteneur FHIRHub...${NC}"
docker restart fhirhub

echo -e "${YELLOW}Redémarrage du conteneur Prometheus...${NC}"
docker restart fhirhub-prometheus

echo -e "${YELLOW}Redémarrage du conteneur Grafana...${NC}"
docker restart fhirhub-grafana

# Vérifier que les conteneurs sont bien redémarrés
echo -e "${YELLOW}Vérification de l'état des conteneurs...${NC}"
FHIRHUB_STATUS=$(docker ps | grep fhirhub | grep -v prometheus | grep -v grafana | awk '{print $NF " est " $7 $8}')
PROMETHEUS_STATUS=$(docker ps | grep fhirhub-prometheus | awk '{print $NF " est " $7 $8}')
GRAFANA_STATUS=$(docker ps | grep fhirhub-grafana | awk '{print $NF " est " $7 $8}')

echo -e "${GREEN}✓ $FHIRHUB_STATUS${NC}"
echo -e "${GREEN}✓ $PROMETHEUS_STATUS${NC}"
echo -e "${GREEN}✓ $GRAFANA_STATUS${NC}"

echo -e "\n${BLUE}=== Tous les services ont été redémarrés avec succès! ===${NC}"
echo -e "${YELLOW}Vous pouvez maintenant accéder à Grafana sur: http://localhost:3000${NC}"
echo -e "${YELLOW}Identifiants par défaut: admin / admin123${NC}"
echo -e "\n${BLUE}Tableaux de bord disponibles:${NC}"
echo -e "1. Logs de Conversion FHIRHub - Vue générale"
echo -e "2. Logs FHIRHub (Détaillé) - Vue détaillée avec filtrage avancé"
echo -e "\n${YELLOW}Conseils:${NC}"
echo -e "- Si les données n'apparaissent pas immédiatement, rafraîchissez la page ou ajustez la plage de temps"
echo -e "- Essayez d'effectuer quelques conversions pour générer des données"
echo -e "- Utilisez les filtres par niveau (info/warning/error) pour isoler les problèmes"
echo -e "- Vérifiez les connexions aux sources de données dans la section Configuration > Data Sources"