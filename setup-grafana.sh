#!/bin/bash

# Script pour configurer Grafana avec les tableaux de bord FHIRHub
# et le bon mot de passe administrateur

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Configuration de Grafana pour FHIRHub ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si le conteneur Grafana est en cours d'exécution
if ! docker ps | grep -q fhirhub-grafana; then
  echo -e "${YELLOW}Le conteneur Grafana n'est pas en cours d'exécution.${NC}"
  echo -e "${YELLOW}Démarrage des conteneurs...${NC}"
  docker-compose up -d grafana
  sleep 5
  
  # Vérifier à nouveau
  if ! docker ps | grep -q fhirhub-grafana; then
    echo -e "${RED}Erreur: Impossible de démarrer le conteneur Grafana.${NC}"
    exit 1
  fi
fi

# Préparer les répertoires
echo -e "${BLUE}[1/4] Préparation des répertoires...${NC}"
mkdir -p volumes/grafana
chmod -R 777 volumes/grafana

# Vérifier les tableaux de bord
echo -e "${BLUE}[2/4] Vérification des tableaux de bord...${NC}"
if [ ! -d "grafana/dashboards" ]; then
  echo -e "${YELLOW}Création du répertoire des tableaux de bord...${NC}"
  mkdir -p grafana/dashboards
  echo -e "${GREEN}✓ Répertoire des tableaux de bord créé${NC}"
else
  echo -e "${GREEN}✓ Répertoire des tableaux de bord existe déjà${NC}"
fi

# Vérifier le conteneur Grafana
echo -e "${BLUE}[3/4] Mise à jour du mot de passe...${NC}"

# Mot de passe à utiliser (par défaut admin123)
ADMIN_PASSWORD="admin123"

# Si un mot de passe est fourni en argument, l'utiliser
if [ ! -z "$1" ]; then
  ADMIN_PASSWORD="$1"
  echo -e "${YELLOW}Utilisation du mot de passe personnalisé: $ADMIN_PASSWORD${NC}"
fi

# Mettre à jour le fichier docker-compose.yml
if grep -q "GF_SECURITY_ADMIN_PASSWORD=" docker-compose.yml; then
  sed -i "s/GF_SECURITY_ADMIN_PASSWORD=.*/GF_SECURITY_ADMIN_PASSWORD=$ADMIN_PASSWORD/" docker-compose.yml
  echo -e "${GREEN}✓ Mot de passe Grafana mis à jour dans docker-compose.yml${NC}"
else
  echo -e "${RED}× Paramètre GF_SECURITY_ADMIN_PASSWORD non trouvé dans docker-compose.yml${NC}"
fi

# Redémarrer le conteneur pour appliquer les changements
echo -e "${BLUE}[4/4] Redémarrage de Grafana...${NC}"
docker restart fhirhub-grafana

# Vérifier que le conteneur est bien redémarré
sleep 3
if docker ps | grep -q fhirhub-grafana; then
  echo -e "${GREEN}✓ Grafana redémarré avec succès${NC}"
else
  echo -e "${RED}× Erreur lors du redémarrage de Grafana${NC}"
fi

echo -e "${BLUE}=== Configuration terminée ===${NC}"
echo -e "${GREEN}Grafana est accessible à l'adresse : http://localhost:3000${NC}"
echo -e "${YELLOW}Identifiants :${NC}"
echo -e "${YELLOW}- Utilisateur : admin${NC}"
echo -e "${YELLOW}- Mot de passe : $ADMIN_PASSWORD${NC}"
echo -e "${BLUE}=== Fin de la configuration ===${NC}"