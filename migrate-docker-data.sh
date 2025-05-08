#!/bin/bash

# Script de migration des données entre l'ancienne et la nouvelle configuration Docker
# Permet de conserver les données lors de la mise à jour vers des volumes nommés

set -e

# Couleurs pour une meilleure lisibilité
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}       Migration des données Docker pour FHIRHub         ${NC}"
echo -e "${BLUE}=========================================================${NC}"

# Vérifier si docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker n'est pas installé ou n'est pas dans le PATH.${NC}"
    echo -e "Veuillez installer Docker avant d'exécuter ce script."
    exit 1
fi

# Vérifier si la structure de dossiers data existe
if [ ! -d "./data" ]; then
    echo -e "${YELLOW}Le dossier ./data n'existe pas. Pas de données à migrer.${NC}"
    echo -e "Création de la structure de dossiers import/export..."
    mkdir -p ./import ./export
    echo -e "${GREEN}Vous pouvez maintenant démarrer FHIRHub avec la nouvelle configuration.${NC}"
    exit 0
fi

# Créer dossiers import/export s'ils n'existent pas
mkdir -p ./import ./export

echo -e "${YELLOW}Sauvegarde des données existantes...${NC}"

# Créer un conteneur temporaire pour migrer les données
echo -e "${BLUE}Création d'un conteneur temporaire pour la migration...${NC}"
docker run --name fhirhub-migration-temp -d \
    -v fhirhub_db:/mnt/db \
    -v fhirhub_data:/mnt/data \
    -v fhirhub_logs:/mnt/logs \
    -v fhirhub_backups:/mnt/backups \
    -v fhirhub_terminology:/mnt/terminology \
    -v $(pwd)/data:/mnt/old_data \
    alpine:latest \
    sleep 3600

echo -e "${BLUE}Copie des données de l'ancien format vers les nouveaux volumes...${NC}"

# Copier les données
docker exec fhirhub-migration-temp sh -c "
    mkdir -p /mnt/db /mnt/data /mnt/logs /mnt/backups /mnt/terminology
    cp -r /mnt/old_data/db/* /mnt/db/ 2>/dev/null || true
    cp -r /mnt/old_data/app_data/* /mnt/data/ 2>/dev/null || true
    cp -r /mnt/old_data/logs/* /mnt/logs/ 2>/dev/null || true
    cp -r /mnt/old_data/backups/* /mnt/backups/ 2>/dev/null || true
    cp -r /mnt/old_data/french_terminology/* /mnt/terminology/ 2>/dev/null || true
    echo 'Migration terminée'
"

# Nettoyer
echo -e "${BLUE}Nettoyage du conteneur temporaire...${NC}"
docker stop fhirhub-migration-temp
docker rm fhirhub-migration-temp

echo -e "${GREEN}Migration des données terminée avec succès!${NC}"
echo -e "${YELLOW}IMPORTANT: Votre configuration Docker a été mise à jour. Les données sont maintenant stockées dans des volumes Docker nommés.${NC}"
echo -e "${YELLOW}Les anciens dossiers dans ./data sont maintenant sauvegardés mais ne seront plus utilisés.${NC}"
echo -e "${YELLOW}Si vous souhaitez les supprimer après avoir vérifié que tout fonctionne correctement, vous pouvez le faire manuellement.${NC}"
echo -e "${YELLOW}IMPORTANT: L'application utilise désormais le port 5001 au lieu de 5000 pour éviter les conflits.${NC}"
echo -e "\nPour démarrer FHIRHub avec la nouvelle configuration, exécutez:"
echo -e "${BLUE}docker-compose up -d${NC}"
echo -e "ou pour la version minimale:"
echo -e "${BLUE}docker-compose -f docker-compose-minimal.yml up -d${NC}"
echo -e "\nL'application sera accessible à l'adresse: ${GREEN}http://localhost:5001${NC}"

exit 0