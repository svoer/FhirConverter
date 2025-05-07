#!/bin/bash

# Script de démarrage pour FHIRHub avec Loki et Watchtower

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher le message d'en-tête
print_header() {
    echo -e "${BLUE}"
    echo "====================================================="
    echo "      FHIRHub - Démarrage complet avec Monitoring"
    echo "====================================================="
    echo -e "${NC}"
}

# Vérifier si docker est installé
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker n'est pas installé. Veuillez l'installer avant de continuer.${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose n'est pas installé. Veuillez l'installer avant de continuer.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker et Docker Compose sont correctement installés${NC}"
}

# Créer les répertoires nécessaires
create_directories() {
    echo "Création des répertoires pour les volumes..."
    
    # Créer les répertoires pour les volumes principaux
    mkdir -p ./volumes/db
    mkdir -p ./volumes/data
    mkdir -p ./volumes/logs
    mkdir -p ./volumes/backups
    mkdir -p ./volumes/french_terminology
    mkdir -p ./volumes/prometheus
    mkdir -p ./volumes/grafana
    mkdir -p ./volumes/loki
    
    # Assurer les permissions
    chmod -R 777 ./volumes
    
    echo -e "${GREEN}✓ Répertoires créés avec succès${NC}"
}

# Préparer les configurations
prepare_configs() {
    echo "Vérification des fichiers de configuration..."
    
    if [ ! -d "./prometheus" ]; then
        mkdir -p ./prometheus
        echo -e "${YELLOW}Création du répertoire prometheus...${NC}"
        
        # Créer un fichier prometheus.yml par défaut s'il n'existe pas
        if [ ! -f "./prometheus/prometheus.yml" ]; then
            cat > ./prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
        
  - job_name: 'fhirhub'
    static_configs:
      - targets: ['fhirhub:9091']
  
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
EOF
            echo -e "${GREEN}✓ Fichier prometheus.yml créé${NC}"
        fi
    fi
    
    # Vérifier les répertoires pour Grafana
    if [ ! -d "./grafana/provisioning/datasources" ]; then
        mkdir -p ./grafana/provisioning/datasources
        mkdir -p ./grafana/provisioning/dashboards
        mkdir -p ./grafana/dashboards
        echo -e "${YELLOW}Création des répertoires Grafana...${NC}"
    fi
    
    # Vérifier les répertoires pour Loki
    if [ ! -d "./loki" ]; then
        mkdir -p ./loki
        echo -e "${YELLOW}Création du répertoire Loki...${NC}"
    fi
    
    # Vérifier les répertoires pour Promtail
    if [ ! -d "./promtail" ]; then
        mkdir -p ./promtail
        echo -e "${YELLOW}Création du répertoire Promtail...${NC}"
    fi
    
    echo -e "${GREEN}✓ Configuration prête${NC}"
}

# Démarrer les services avec docker-compose
start_services() {
    echo "Démarrage des services FHIRHub avec Docker Compose..."
    
    # Construire et démarrer les conteneurs
    docker-compose up -d --build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Les services FHIRHub ont été démarrés avec succès${NC}"
    else
        echo -e "${RED}Erreur lors du démarrage des services FHIRHub${NC}"
        exit 1
    fi
}

# Vérifier l'état des services
check_services() {
    echo "Vérification de l'état des services..."
    
    # Vérifier FHIRHub
    if [ "$(docker ps -q -f name=fhirhub)" ]; then
        echo -e "${GREEN}✓ FHIRHub est en cours d'exécution${NC}"
    else
        echo -e "${RED}FHIRHub n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Prometheus
    if [ "$(docker ps -q -f name=fhirhub-prometheus)" ]; then
        echo -e "${GREEN}✓ Prometheus est en cours d'exécution${NC}"
    else
        echo -e "${RED}Prometheus n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Grafana
    if [ "$(docker ps -q -f name=fhirhub-grafana)" ]; then
        echo -e "${GREEN}✓ Grafana est en cours d'exécution${NC}"
    else
        echo -e "${RED}Grafana n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Node Exporter
    if [ "$(docker ps -q -f name=fhirhub-node-exporter)" ]; then
        echo -e "${GREEN}✓ Node Exporter est en cours d'exécution${NC}"
    else
        echo -e "${RED}Node Exporter n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Loki
    if [ "$(docker ps -q -f name=fhirhub-loki)" ]; then
        echo -e "${GREEN}✓ Loki est en cours d'exécution${NC}"
    else
        echo -e "${RED}Loki n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Promtail
    if [ "$(docker ps -q -f name=fhirhub-promtail)" ]; then
        echo -e "${GREEN}✓ Promtail est en cours d'exécution${NC}"
    else
        echo -e "${RED}Promtail n'est pas en cours d'exécution${NC}"
    fi
    
    # Vérifier Watchtower
    if [ "$(docker ps -q -f name=fhirhub-watchtower)" ]; then
        echo -e "${GREEN}✓ Watchtower est en cours d'exécution${NC}"
    else
        echo -e "${RED}Watchtower n'est pas en cours d'exécution${NC}"
    fi
}

# Afficher les informations d'accès
show_access_info() {
    echo -e "${BLUE}"
    echo "====================================================="
    echo "      Informations d'accès FHIRHub"
    echo "====================================================="
    echo -e "${NC}"
    
    # Obtenir l'adresse IP locale
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    echo -e "${YELLOW}Application FHIRHub:${NC}"
    echo -e "  URL: http://$IP_ADDRESS:5000"
    echo -e "  URL locale: http://localhost:5000"
    echo ""
    
    echo -e "${YELLOW}Grafana (Tableaux de bord et monitoring):${NC}"
    echo -e "  URL: http://$IP_ADDRESS:3000"
    echo -e "  URL locale: http://localhost:3000"
    echo -e "  Identifiants: admin / admin123"
    echo ""
    
    echo -e "${YELLOW}Prometheus (Métriques brutes):${NC}"
    echo -e "  URL: http://$IP_ADDRESS:9092"
    echo -e "  URL locale: http://localhost:9092"
    echo ""
    
    echo -e "${YELLOW}Loki (Logs):${NC}"
    echo -e "  URL: http://$IP_ADDRESS:3100"
    echo -e "  URL locale: http://localhost:3100"
    echo ""
    
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${GREEN}FHIRHub est prêt à l'emploi!${NC}"
    echo -e "${BLUE}====================================================${NC}"
}

# Exécution principale
print_header
check_docker
create_directories
prepare_configs
start_services
check_services
show_access_info

exit 0