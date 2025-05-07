#!/bin/bash

# Script pour restaurer les données FHIRHub après un redémarrage Docker
# À exécuter APRÈS docker-compose up -d

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si un argument a été passé (chemin de sauvegarde)
if [ -z "$1" ]; then
  echo -e "${RED}Erreur: Chemin de sauvegarde manquant.${NC}"
  echo -e "Usage: $0 ./volumes/backups/YYYYMMDD_HHMMSS"
  exit 1
fi

BACKUP_DIR="$1"

# Vérifier si le dossier de sauvegarde existe
if [ ! -d "$BACKUP_DIR" ]; then
  echo -e "${RED}Erreur: Le dossier de sauvegarde $BACKUP_DIR n'existe pas.${NC}"
  exit 1
fi

echo -e "${BLUE}=== Restauration des données FHIRHub après redémarrage Docker ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si le conteneur FHIRHub est en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${RED}Erreur: Conteneur FHIRHub non trouvé. Veuillez démarrer les conteneurs avec docker-compose up -d${NC}"
  exit 1
fi

echo -e "${YELLOW}Restauration de la base de données SQLite...${NC}"
# Vérifier si le fichier de sauvegarde existe
if [ ! -f "$BACKUP_DIR/fhirhub.db" ]; then
  echo -e "${RED}Erreur: Fichier de sauvegarde de la base de données non trouvé.${NC}"
  exit 1
fi

# Copier la base de données dans le conteneur
docker cp $BACKUP_DIR/fhirhub.db fhirhub:/app/storage/db/fhirhub.db.restore
# Puis remplacer la base de données actuelle
docker exec fhirhub cp /app/storage/db/fhirhub.db.restore /app/storage/db/fhirhub.db

echo -e "${YELLOW}Restauration des données applicatives...${NC}"
# Vérifier si le fichier de sauvegarde existe
if [ ! -f "$BACKUP_DIR/data_backup.tar.gz" ]; then
  echo -e "${RED}Erreur: Fichier de sauvegarde des données applicatives non trouvé.${NC}"
  exit 1
fi

# Copier l'archive dans le conteneur
docker cp $BACKUP_DIR/data_backup.tar.gz fhirhub:/app/storage/backups/
# Extraire l'archive
docker exec fhirhub tar -xzf /app/storage/backups/data_backup.tar.gz -C /

echo -e "${YELLOW}Correctifs de permissions...${NC}"
# Corriger les permissions dans le conteneur
docker exec fhirhub chmod -R 777 /app/storage/db
docker exec fhirhub chmod -R 777 /app/storage/data

echo -e "${YELLOW}Redémarrage du conteneur pour appliquer les changements...${NC}"
docker restart fhirhub

echo -e "${GREEN}Restauration terminée avec succès !${NC}"
echo -e "${BLUE}Les données ont été restaurées depuis : ${BACKUP_DIR}${NC}"
echo -e ""
echo -e "${YELLOW}Vérifiez que l'application fonctionne correctement en accédant à :${NC}"
echo -e "  http://localhost:5000"