#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Correction des permissions pour Loki...${NC}"

# Vérifier si le dossier loki existe
if [ ! -d "loki" ]; then
    echo -e "${RED}Le dossier loki n'existe pas. Initialisation requise.${NC}"
    echo -e "${BLUE}Exécutez d'abord:${NC}"
    echo -e "${YELLOW}./docker-init.sh${NC}"
    exit 1
fi

# Création des sous-dossiers s'ils n'existent pas
echo -e "${BLUE}Création des sous-dossiers nécessaires...${NC}"
mkdir -p loki/chunks
mkdir -p loki/index
mkdir -p loki/cache
mkdir -p loki/wal
mkdir -p loki/compactor

# Changement des permissions (essai avec sudo d'abord, puis sans sudo)
echo -e "${BLUE}Attribution des permissions à l'utilisateur 10001 (Loki)...${NC}"
sudo chown -R 10001:10001 loki || { 
    echo -e "${RED}Erreur lors de la modification des permissions avec sudo. Tentative sans sudo...${NC}"
    chown -R 10001:10001 loki || {
        echo -e "${RED}Impossible de modifier les permissions. Tentative avec une commande Docker...${NC}"
        
        # Si les deux tentatives échouent, essayons avec Docker
        if [ "$(docker ps -a -q -f name=fhirhub-loki)" ]; then
            docker stop fhirhub-loki
            echo -e "${BLUE}Utilisation d'un conteneur temporaire pour modifier les permissions...${NC}"
            docker run --rm -v $(pwd)/loki:/data alpine sh -c "chown -R 10001:10001 /data"
        else
            echo -e "${RED}Le conteneur Loki n'existe pas et les permissions n'ont pas pu être modifiées.${NC}"
            echo -e "${RED}Vous devrez peut-être exécuter ce script en tant que superutilisateur.${NC}"
            exit 1
        fi
    }
}

echo -e "${BLUE}Vérification des permissions appliquées...${NC}"
ls -la loki

echo -e "${GREEN}Permissions mises à jour pour Loki.${NC}"
echo -e "${BLUE}Pour redémarrer Loki avec les nouvelles permissions, exécutez:${NC}"
echo -e "${YELLOW}./docker-restart-loki.sh${NC}"