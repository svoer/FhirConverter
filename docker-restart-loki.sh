#!/bin/bash

# Script pour redémarrer les services Loki et Promtail
# À exécuter en cas de problème avec les logs dans Grafana

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}   Redémarrage des services de logs FHIRHub      ${NC}"
echo -e "${BLUE}=================================================${NC}"

# Vérifier si Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker n'est pas en cours d'exécution ou vous n'avez pas les permissions nécessaires.${NC}"
    echo -e "${YELLOW}Veuillez démarrer Docker ou exécuter ce script avec sudo si nécessaire.${NC}"
    exit 1
fi

# Fonction pour redémarrer un conteneur
restart_container() {
    local container=$1
    echo -e "${YELLOW}Redémarrage de $container...${NC}"
    
    if docker ps -q -f name=$container > /dev/null; then
        docker restart $container
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ $container redémarré avec succès${NC}"
        else
            echo -e "${RED}× Erreur lors du redémarrage de $container${NC}"
        fi
    else
        echo -e "${RED}× Le conteneur $container n'est pas en cours d'exécution${NC}"
        echo -e "${YELLOW}Tentative de démarrage initial...${NC}"
        
        docker start $container 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ $container démarré avec succès${NC}"
        else
            echo -e "${RED}× Impossible de démarrer $container${NC}"
            echo -e "${YELLOW}Vérifiez que le conteneur existe avec: docker ps -a${NC}"
            echo -e "${YELLOW}Si nécessaire, recréez tous les conteneurs avec: docker-compose up -d${NC}"
        fi
    fi
}

# Appliquer les permissions pour Loki
echo -e "${YELLOW}Application des permissions pour les volumes Loki...${NC}"

# Créer les répertoires si nécessaire
mkdir -p ./volumes/loki/chunks ./volumes/loki/index ./volumes/loki/wal ./volumes/loki/compactor

# Définir les permissions
chmod -R 777 ./volumes/loki

echo -e "${GREEN}✓ Permissions configurées${NC}"

# Redémarrer les conteneurs dans l'ordre approprié
restart_container "fhirhub-loki"
restart_container "fhirhub-promtail"
restart_container "fhirhub"
restart_container "fhirhub-grafana"

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}Redémarrage des services terminé!${NC}"
echo -e "${BLUE}Pour vérifier l'état des conteneurs:${NC}"
echo -e "${YELLOW}docker ps | grep fhirhub${NC}"
echo -e ""
echo -e "${BLUE}Pour vérifier les logs des conteneurs:${NC}"
echo -e "${YELLOW}docker logs fhirhub-loki${NC}"
echo -e "${YELLOW}docker logs fhirhub-promtail${NC}"
echo -e "${YELLOW}docker logs fhirhub-grafana${NC}"
echo -e ""
echo -e "${BLUE}Accès aux interfaces:${NC}"
echo -e "${YELLOW}- Grafana: http://localhost:3000${NC}"
echo -e "${YELLOW}- Loki: http://localhost:3100${NC}"
echo -e ""
echo -e "${BLUE}Si les logs n'apparaissent toujours pas dans Grafana:${NC}"
echo -e "${YELLOW}1. Vérifiez que la source de données Loki est correctement configurée dans Grafana${NC}"
echo -e "${YELLOW}2. Vérifiez que les conteneurs sont en cours d'exécution${NC}"
echo -e "${YELLOW}3. Vérifiez que les volumes ont les bonnes permissions${NC}"
echo -e "${YELLOW}4. Exécutez: ./fix-docker-loki-permissions.sh${NC}"
echo -e "${BLUE}=================================================${NC}"

exit 0