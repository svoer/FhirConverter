#!/bin/bash

# Script pour initialiser l'environnement Docker de FHIRHub
# Ce script crée la structure des répertoires pour les volumes docker

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Initialisation de l'environnement Docker pour FHIRHub ===${NC}"

# Création des répertoires pour les volumes
echo -e "${YELLOW}Création des répertoires pour les volumes Docker...${NC}"
mkdir -p volumes/data volumes/logs volumes/backups volumes/french_terminology

# Vérification si les répertoires existent
if [ -d "volumes/data" ] && [ -d "volumes/logs" ] && [ -d "volumes/backups" ] && [ -d "volumes/french_terminology" ]; then
  echo -e "${GREEN}✓ Structure des répertoires pour les volumes créée avec succès${NC}"
else
  echo -e "${RED}× Erreur lors de la création des répertoires${NC}"
  exit 1
fi

# Création des sous-répertoires de data
echo -e "${YELLOW}Création des sous-répertoires de data...${NC}"
mkdir -p volumes/data/conversions volumes/data/history volumes/data/outputs volumes/data/test

# Configuration des permissions
echo -e "${YELLOW}Configuration des permissions...${NC}"
chmod -R 755 volumes

# Créer un fichier .env si inexistant
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Création du fichier .env par défaut...${NC}"
  cat > .env << EOF
# Configuration FHIRHub Docker
PORT=5000
JWT_SECRET=fhirhub-secure-jwt-secret-change-me
DATA_DIR=./volumes/data
LOGS_DIR=./volumes/logs
BACKUPS_DIR=./volumes/backups
TERMINOLOGY_DIR=./volumes/french_terminology
EOF
  echo -e "${GREEN}✓ Fichier .env créé${NC}"
else
  echo -e "${GREEN}✓ Fichier .env existant conservé${NC}"
fi

echo -e "${GREEN}=== Initialisation terminée avec succès ===${NC}"
echo -e "${BLUE}Pour démarrer FHIRHub, exécutez:${NC}"
echo -e "${YELLOW}docker-compose -f docker-compose.prod.yml up -d${NC}"
echo -e "${BLUE}Pour accéder à l'application:${NC}"
echo -e "${YELLOW}http://localhost:5000${NC}"
echo -e "${BLUE}Identifiants par défaut:${NC}"
echo -e "${YELLOW}Utilisateur: admin${NC}"
echo -e "${YELLOW}Mot de passe: adminfhirhub${NC}"
echo -e "${BLUE}=== Fin de l'initialisation ===${NC}"

# Rendre le script exécutable
chmod +x docker-init.sh