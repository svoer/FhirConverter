#!/bin/bash

# Script de démarrage pour l'application FHIRHub avec configuration minimale
# Convertisseur HL7 v2.5 vers FHIR R4 avec terminologies françaises
# Version 1.3.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Version fixe de l'application
APP_VERSION="1.3.0"

# Bannière de démarrage
echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo -e "   Version ${APP_VERSION} - Compatible ANS"
echo -e "   Mode Minimal - $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

echo -e "${GREEN}Initialisation du système de conversion HL7 vers FHIR (mode minimal)...${NC}"
echo -e "${GREEN}Chargement des terminologies françaises...${NC}"

# Vérification de l'intégrité du système
echo -e "${BLUE}[1/3] Vérification de la structure des dossiers...${NC}"

# Initialisation de la structure simplifiée
./docker-init-simple.sh

# Vérification de Docker
echo -e "${BLUE}[2/3] Vérification de Docker...${NC}"
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Erreur: Docker et/ou Docker Compose ne sont pas installés.${NC}"
    echo -e "${YELLOW}Veuillez installer Docker et Docker Compose, puis réessayer.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker et Docker Compose sont disponibles${NC}"

# Démarrage du service
echo -e "${BLUE}[3/3] Démarrage du service FHIRHub...${NC}"
docker-compose -f docker-compose-minimal.yml up -d

# Vérification que le conteneur a bien démarré
if docker ps | grep fhirhub &> /dev/null; then
    echo -e "${GREEN}✓ Service FHIRHub démarré avec succès${NC}"
    echo -e "${BLUE}----------------------------------------------------${NC}"
    echo -e "${GREEN}✓ FHIRHub est accessible à l'adresse: http://localhost:5000${NC}"
    echo -e "${GREEN}✓ Métriques disponibles à l'adresse: http://localhost:9091/metrics${NC}"
    echo -e "${BLUE}----------------------------------------------------${NC}"
else
    echo -e "${RED}Erreur: Le service FHIRHub n'a pas pu démarrer correctement.${NC}"
    echo -e "${YELLOW}Consultez les logs avec la commande: docker logs fhirhub${NC}"
    exit 1
fi

echo -e "${CYAN}FHIRHub (version minimale) est prêt !${NC}"