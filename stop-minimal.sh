#!/bin/bash

# Script d'arrêt pour la configuration minimale de FHIRHub
# Version 1.3.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Bannière d'arrêt
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Arrêt du service (version minimale)"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# Vérification de Docker
echo -e "${BLUE}[1/2] Vérification de Docker...${NC}"
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Erreur: Docker et/ou Docker Compose ne sont pas installés.${NC}"
    echo -e "${YELLOW}Veuillez installer Docker et Docker Compose, puis réessayer.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker et Docker Compose sont disponibles${NC}"

# Arrêt des services
echo -e "${BLUE}[2/2] Arrêt du service FHIRHub...${NC}"
docker-compose -f docker-compose-minimal.yml down

# Vérification de l'arrêt
if ! docker ps | grep fhirhub &> /dev/null; then
    echo -e "${GREEN}✓ Service FHIRHub arrêté avec succès${NC}"
else
    echo -e "${RED}Erreur: Impossible d'arrêter le service FHIRHub.${NC}"
    echo -e "${YELLOW}Essayez d'arrêter manuellement avec: docker stop fhirhub${NC}"
    exit 1
fi

echo -e "${CYAN}Le service FHIRHub a été arrêté avec succès.${NC}"