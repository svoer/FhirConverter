#!/bin/bash

# Script d'arrêt pour la configuration minimale de FHIRHub avec Prometheus et Grafana
# Version 1.0.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================================="
echo -e "   Arrêt de FHIRHub - Configuration Minimale"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Erreur: Docker n'est pas installé.${NC}"
  exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Erreur: Docker Compose n'est pas installé.${NC}"
  exit 1
fi

# Vérifier si les arguments sont fournis
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
  echo -e "${YELLOW}Mode nettoyage activé: les conteneurs et les volumes seront supprimés${NC}"
  CLEAN_MODE=true
else
  CLEAN_MODE=false
fi

# Arrêt des conteneurs
echo -e "${BLUE}Arrêt des conteneurs Docker...${NC}"

if [ "$CLEAN_MODE" = true ]; then
  docker-compose -f docker-compose-minimal.yml down -v
  echo -e "${GREEN}Conteneurs et volumes arrêtés et supprimés${NC}"
  
  read -p "Voulez-vous aussi supprimer les données locales (./data) ? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Suppression des données locales...${NC}"
    rm -rf ./data/*
    echo -e "${GREEN}Données locales supprimées${NC}"
  else
    echo -e "${BLUE}Les données locales ont été conservées${NC}"
  fi
else
  docker-compose -f docker-compose-minimal.yml down
  echo -e "${GREEN}Conteneurs arrêtés${NC}"
  echo -e "${BLUE}Note: Les volumes Docker sont conservés. Utilisez --clean pour les supprimer.${NC}"
fi

echo -e "${CYAN}=========================================================="
echo -e "   Services FHIRHub arrêtés avec succès"
echo -e "==========================================================${NC}"