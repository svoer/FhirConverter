#!/bin/bash

# Script pour réinitialiser tous les mots de passe administrateur
# dans le système FHIRHub (application et conteneurs)

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Réinitialisation des mots de passe administrateur FHIRHub ===${NC}"

# Lecture des paramètres
NEW_PASSWORD=${1:-"admin123"}
USERNAME=${2:-"admin"}

echo -e "${YELLOW}Réinitialisation du mot de passe pour l'utilisateur ${USERNAME}${NC}"
echo -e "${YELLOW}Nouveau mot de passe : ${NEW_PASSWORD}${NC}"

# 1. Réinitialiser le mot de passe de l'application
echo -e "${BLUE}[1/3] Réinitialisation du mot de passe dans l'application...${NC}"
node reset-password-pbkdf2.js "$USERNAME" "$NEW_PASSWORD"

if [ $? -ne 0 ]; then
  echo -e "${RED}Erreur lors de la réinitialisation du mot de passe dans l'application${NC}"
  echo -e "${YELLOW}Continuer avec les autres réinitialisations...${NC}"
fi

# 2. Mettre à jour le fichier .env
echo -e "${BLUE}[2/3] Mise à jour du fichier .env...${NC}"
if [ -f ".env" ]; then
  # Vérifier si le paramètre existe déjà
  if grep -q "^ADMIN_PASSWORD=" .env; then
    # Remplacer la valeur existante
    sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$NEW_PASSWORD/" .env
    echo -e "${GREEN}✓ Fichier .env mis à jour${NC}"
  else
    # Ajouter le paramètre s'il n'existe pas
    echo "ADMIN_PASSWORD=$NEW_PASSWORD" >> .env
    echo -e "${GREEN}✓ Paramètre ADMIN_PASSWORD ajouté au fichier .env${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ Fichier .env non trouvé, création...${NC}"
  echo "ADMIN_PASSWORD=$NEW_PASSWORD" > .env
  echo -e "${GREEN}✓ Fichier .env créé avec le mot de passe administrateur${NC}"
fi

# 3. Mettre à jour docker-compose.yml pour Grafana
echo -e "${BLUE}[3/3] Mise à jour du mot de passe Grafana dans docker-compose.yml...${NC}"
if [ -f "docker-compose.yml" ]; then
  # Vérifier si le paramètre existe déjà
  if grep -q "GF_SECURITY_ADMIN_PASSWORD=" docker-compose.yml; then
    # Remplacer la valeur existante
    sed -i "s/GF_SECURITY_ADMIN_PASSWORD=.*/GF_SECURITY_ADMIN_PASSWORD=$NEW_PASSWORD/" docker-compose.yml
    echo -e "${GREEN}✓ Mot de passe Grafana mis à jour dans docker-compose.yml${NC}"
    
    echo -e "${YELLOW}Pour appliquer les changements, redémarrez les conteneurs :${NC}"
    echo -e "  docker-compose restart"
  else
    echo -e "${RED}× Paramètre GF_SECURITY_ADMIN_PASSWORD non trouvé dans docker-compose.yml${NC}"
  fi
else
  echo -e "${RED}× Fichier docker-compose.yml non trouvé${NC}"
fi

# Résumé
echo -e "${BLUE}=== Résumé des opérations ===${NC}"
echo -e "${GREEN}✓ Mot de passe réinitialisé pour l'application FHIRHub${NC}"
echo -e "${GREEN}✓ Mot de passe mis à jour dans le fichier .env${NC}"
if [ -f "docker-compose.yml" ] && grep -q "GF_SECURITY_ADMIN_PASSWORD=" docker-compose.yml; then
  echo -e "${GREEN}✓ Mot de passe Grafana mis à jour dans docker-compose.yml${NC}"
else
  echo -e "${RED}× Mot de passe Grafana non mis à jour${NC}"
fi

echo -e "${BLUE}=== Instructions supplémentaires ===${NC}"
echo -e "${YELLOW}1. Si vous êtes en environnement Docker, redémarrez les conteneurs :${NC}"
echo -e "   docker-compose restart"
echo -e "${YELLOW}2. Vérifiez les permissions des volumes Grafana et Prometheus :${NC}"
echo -e "   sudo ./fix-grafana-permissions.sh"
echo -e "${YELLOW}3. Identifiants à utiliser :${NC}"
echo -e "   - Nom d'utilisateur : ${USERNAME}"
echo -e "   - Mot de passe : ${NEW_PASSWORD}"