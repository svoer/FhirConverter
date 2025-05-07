#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Redémarrage de Loki et vérification de la configuration...${NC}"

# Vérifier si le container Loki existe
if [ "$(docker ps -a -q -f name=fhirhub-loki)" ]; then
    echo -e "${BLUE}Arrêt du container Loki...${NC}"
    docker stop fhirhub-loki

    echo -e "${BLUE}Suppression du container Loki...${NC}"
    docker rm fhirhub-loki

    # Correction des permissions du dossier Loki
    echo -e "${BLUE}Correction des permissions du dossier Loki...${NC}"
    if [ -d "loki" ]; then
        sudo chown -R 10001:10001 loki || { 
            echo -e "${RED}Erreur lors de la modification des permissions. Tentative sans sudo...${NC}"
            chown -R 10001:10001 loki || echo -e "${YELLOW}Attention: Permissions non modifiées, utilisez fix-docker-loki-permissions.sh séparément${NC}"
        }
    fi

    # Recréation des dossiers de données si nécessaire
    echo -e "${BLUE}Préparation des dossiers de données pour Loki...${NC}"
    mkdir -p loki/chunks
    mkdir -p loki/index
    mkdir -p loki/cache
    mkdir -p loki/wal
    mkdir -p loki/compactor

    # Assignation des permissions
    sudo chown -R 10001:10001 loki || { 
        echo -e "${RED}Erreur lors de la modification des permissions. Tentative sans sudo...${NC}"
        chown -R 10001:10001 loki || echo -e "${YELLOW}Attention: Permissions non modifiées, utilisez fix-docker-loki-permissions.sh séparément${NC}"
    }

    echo -e "${BLUE}Recréation du container Loki avec la configuration corrigée...${NC}"
    # Récupérer la version actuelle du docker-compose
    if docker-compose --version &>/dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &>/dev/null; then
        COMPOSE_CMD="docker compose"
    else
        echo -e "${RED}Docker Compose n'est pas installé. Installation impossible.${NC}"
        exit 1
    fi

    # Utiliser docker-compose pour recréer uniquement le service Loki
    $COMPOSE_CMD up -d loki

    echo -e "${BLUE}Vérification du statut de Loki...${NC}"
    sleep 5
    if docker ps | grep -q fhirhub-loki; then
        echo -e "${GREEN}Loki a démarré avec succès!${NC}"
        echo -e "${BLUE}Vérifiez les logs pour confirmer le bon fonctionnement:${NC}"
        echo -e "${YELLOW}docker logs fhirhub-loki${NC}"
    else
        echo -e "${RED}Erreur: Loki n'a pas démarré correctement.${NC}"
        echo -e "${BLUE}Vérifiez les logs pour plus d'informations:${NC}"
        echo -e "${YELLOW}docker logs fhirhub-loki${NC}"
    fi

    # Redémarrer également Promtail qui dépend de Loki
    echo -e "${BLUE}Redémarrage de Promtail...${NC}"
    $COMPOSE_CMD restart promtail

    echo -e "${GREEN}Processus terminé.${NC}"
else
    echo -e "${RED}Container Loki non trouvé. Exécutez d'abord:${NC}"
    echo -e "${YELLOW}docker-compose up -d${NC}"
fi