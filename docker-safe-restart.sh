#!/bin/bash

# Script pour arrêter et redémarrer proprement les conteneurs Docker
# avec conservation des données et vérification des volumes

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Redémarrage sécurisé des conteneurs FHIRHub ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Étape 1: Sauvegarde automatique des données
echo -e "${YELLOW}Étape 1: Sauvegarde des données...${NC}"
BACKUP_DIR="./volumes/backups/$(date +%Y%m%d_%H%M%S)_restart"
mkdir -p $BACKUP_DIR

# Vérifier si le conteneur FHIRHub est en cours d'exécution pour la sauvegarde
if docker ps | grep -q fhirhub; then
  # Sauvegarder la base de données
  docker exec fhirhub cp /app/storage/db/fhirhub.db /app/storage/db/fhirhub.db.bak
  docker cp fhirhub:/app/storage/db/fhirhub.db.bak $BACKUP_DIR/fhirhub.db
  
  # Sauvegarder les données applicatives
  docker exec fhirhub tar -czf /app/storage/backups/data_backup.tar.gz /app/storage/data
  docker cp fhirhub:/app/storage/backups/data_backup.tar.gz $BACKUP_DIR/
  
  echo -e "${GREEN}✓ Sauvegarde terminée dans ${BACKUP_DIR}${NC}"
else
  echo -e "${YELLOW}⚠ FHIRHub n'est pas en cours d'exécution, aucune sauvegarde possible${NC}"
fi

# Étape 2: Arrêt des conteneurs
echo -e "${YELLOW}Étape 2: Arrêt des conteneurs...${NC}"
docker-compose down
echo -e "${GREEN}✓ Conteneurs arrêtés${NC}"

# Étape 3: Vérification et préparation des volumes
echo -e "${YELLOW}Étape 3: Vérification des volumes...${NC}"

# Créer les répertoires pour les volumes s'ils n'existent pas
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana

# Corriger les permissions
chmod -R 777 volumes/db
chmod -R 777 volumes/data
chmod -R 777 volumes/logs
chmod -R 777 volumes/backups
chmod -R 777 volumes/french_terminology
chmod -R 777 volumes/prometheus
chmod -R 777 volumes/grafana

echo -e "${GREEN}✓ Volumes vérifiés et permissions corrigées${NC}"

# Étape 4: Démarrage des conteneurs
echo -e "${YELLOW}Étape 4: Démarrage des conteneurs...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Conteneurs démarrés${NC}"

# Étape 5: Vérification de l'état des conteneurs
echo -e "${YELLOW}Étape 5: Vérification de l'état des conteneurs...${NC}"
echo -e "${BLUE}Attente du démarrage complet des services...${NC}"
sleep 10

# Vérification du statut des conteneurs
if docker ps | grep -q fhirhub; then
  echo -e "${GREEN}✓ Conteneur FHIRHub démarré avec succès${NC}"
else
  echo -e "${RED}× Erreur: Le conteneur FHIRHub n'est pas démarré${NC}"
fi

echo -e "${YELLOW}Liste des conteneurs en cours d'exécution:${NC}"
docker-compose ps

# Étape 6: Restauration des données si nécessaire
echo -e "${YELLOW}Étape 6: Vérification de la base de données...${NC}"

# Vérifier si la base de données existe dans le conteneur
if docker exec fhirhub ls -la /app/storage/db/fhirhub.db > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Base de données trouvée, vérification de sa taille...${NC}"
  
  # Vérifier la taille de la base de données
  DB_SIZE=$(docker exec fhirhub stat -c%s /app/storage/db/fhirhub.db)
  
  if [ "$DB_SIZE" -lt 10000 ]; then
    echo -e "${YELLOW}⚠ Base de données trop petite ($DB_SIZE octets), restauration depuis la sauvegarde...${NC}"
    
    # Restaurer la base de données depuis la sauvegarde
    if [ -f "$BACKUP_DIR/fhirhub.db" ]; then
      docker cp $BACKUP_DIR/fhirhub.db fhirhub:/app/storage/db/fhirhub.db
      echo -e "${GREEN}✓ Base de données restaurée${NC}"
    else
      echo -e "${RED}× Sauvegarde non trouvée, impossible de restaurer${NC}"
    fi
  else
    echo -e "${GREEN}✓ Base de données de taille correcte ($DB_SIZE octets)${NC}"
  fi
else
  echo -e "${RED}× Base de données non trouvée, restauration depuis la sauvegarde...${NC}"
  
  # Restaurer la base de données depuis la sauvegarde
  if [ -f "$BACKUP_DIR/fhirhub.db" ]; then
    docker cp $BACKUP_DIR/fhirhub.db fhirhub:/app/storage/db/fhirhub.db
    echo -e "${GREEN}✓ Base de données restaurée${NC}"
  else
    echo -e "${RED}× Sauvegarde non trouvée, impossible de restaurer${NC}"
  fi
fi

echo -e "${GREEN}=== Redémarrage sécurisé terminé ! ===${NC}"
echo -e "${BLUE}L'application FHIRHub devrait être accessible à l'adresse:${NC}"
echo -e "  http://localhost:5000"
echo -e ""
echo -e "${YELLOW}Si vous rencontrez des problèmes, vous pouvez restaurer manuellement la sauvegarde:${NC}"
echo -e "  ./restore-docker-data.sh ${BACKUP_DIR}"