#!/bin/bash

# Script de démarrage pour la configuration minimale de FHIRHub avec Prometheus et Grafana
# Version 1.0.0

# Définition des couleurs pour une meilleure lisibilité des logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub - Configuration Minimale avec Monitoring"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "==========================================================${NC}"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Erreur: Docker n'est pas installé.${NC}"
  echo -e "${YELLOW}Veuillez installer Docker et Docker Compose avant de continuer.${NC}"
  exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Erreur: Docker Compose n'est pas installé.${NC}"
  echo -e "${YELLOW}Veuillez installer Docker Compose avant de continuer.${NC}"
  exit 1
fi

# Vérification de l'existence des répertoires de données
echo -e "${BLUE}[1/4] Préparation des répertoires de données...${NC}"

# Créer les répertoires pour les données persistantes
mkdir -p ./data/db ./data/app_data ./data/logs ./data/backups ./data/french_terminology ./data/prometheus ./data/grafana

# Appliquer les permissions nécessaires
echo -e "${BLUE}[2/4] Configuration des permissions...${NC}"
chmod -R 777 ./data

# Vérification des fichiers de configuration de Prometheus
echo -e "${BLUE}[3/4] Vérification de la configuration de Prometheus...${NC}"
if [ ! -d "./prometheus" ]; then
  echo -e "${YELLOW}Création du répertoire pour la configuration de Prometheus...${NC}"
  mkdir -p ./prometheus
fi

if [ ! -f "./prometheus/prometheus.yml" ]; then
  echo -e "${YELLOW}Création du fichier de configuration Prometheus par défaut...${NC}"
  cat > ./prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'fhirhub'
    scrape_interval: 5s
    static_configs:
      - targets: ['fhirhub:9091']
EOF
  echo -e "${GREEN}✅ Configuration Prometheus créée${NC}"
fi

# Vérification des fichiers de configuration de Grafana
echo -e "${BLUE}[4/4] Vérification de la configuration de Grafana...${NC}"
if [ ! -d "./grafana/provisioning/datasources" ]; then
  echo -e "${YELLOW}Création des répertoires pour la configuration de Grafana...${NC}"
  mkdir -p ./grafana/provisioning/datasources
  mkdir -p ./grafana/dashboards
fi

if [ ! -f "./grafana/provisioning/datasources/datasources.yml" ]; then
  echo -e "${YELLOW}Création du fichier de configuration des datasources Grafana...${NC}"
  cat > ./grafana/provisioning/datasources/datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  # Simplejson datasource pour les logs d'application FHIRHub
  - name: FHIRHub Logs
    type: simplejson
    access: proxy
    url: http://fhirhub:9091/api/logs
    isDefault: false
    editable: true
    jsonData:
      timeField: "timestamp"
EOF
  echo -e "${GREEN}✅ Configuration des datasources Grafana créée${NC}"
fi

# Créer un tableau de bord de base si nécessaire
if [ ! -f "./grafana/dashboards/fhirhub_dashboard.json" ]; then
  echo -e "${YELLOW}Création d'un tableau de bord Grafana de base...${NC}"
  cat > ./grafana/dashboards/fhirhub_dashboard.json << 'EOF'
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "grafana",
          "uid": "-- Grafana --"
        },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "target": {
          "limit": 100,
          "matchAny": false,
          "tags": [],
          "type": "dashboard"
        },
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "axisCenteredZero": false,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": 0.5,
            "gradientMode": "none",
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            },
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 5,
            "scaleDistribution": {
              "type": "linear"
            },
            "showPoints": "auto",
            "spanNulls": false,
            "stacking": {
              "group": "A",
              "mode": "none"
            },
            "thresholdsStyle": {
              "mode": "off"
            }
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 2,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "title": "Conversions HL7 vers FHIR",
      "type": "timeseries"
    }
  ],
  "refresh": "5s",
  "schemaVersion": 36,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "FHIRHub Dashboard",
  "uid": "fhirhub",
  "version": 1,
  "weekStart": ""
}
EOF
  echo -e "${GREEN}✅ Tableau de bord Grafana de base créé${NC}"
fi

if [ ! -f "./grafana/provisioning/dashboards/dashboards.yml" ]; then
  echo -e "${YELLOW}Création du fichier de configuration des dashboards Grafana...${NC}"
  cat > ./grafana/provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'FHIRHub'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF
  mkdir -p ./grafana/provisioning/dashboards
  echo -e "${GREEN}✅ Configuration des dashboards Grafana créée${NC}"
fi

# Démarrage des conteneurs
echo -e "${CYAN}Démarrage des conteneurs Docker...${NC}"
docker-compose -f docker-compose-minimal.yml up -d

# Vérification du démarrage des conteneurs
echo -e "${BLUE}Vérification du démarrage des services...${NC}"
sleep 5
running_containers=$(docker-compose -f docker-compose-minimal.yml ps --services --filter "status=running" | wc -l)

if [ "$running_containers" -eq 3 ]; then
  echo -e "${GREEN}✅ Tous les services sont démarrés avec succès!${NC}"
else
  echo -e "${YELLOW}⚠️ Certains services ne sont pas encore démarrés. Vérifiez les logs avec 'docker-compose -f docker-compose-minimal.yml logs'${NC}"
fi

echo -e "${CYAN}=========================================================="
echo -e "   FHIRHub est accessible sur: http://localhost:5001"
echo -e "   Prometheus: http://localhost:9090"
echo -e "   Grafana: http://localhost:3000"
echo -e "      - Utilisateur: admin"
echo -e "      - Mot de passe: admin123"
echo -e "==========================================================${NC}"

echo -e "${BLUE}Pour arrêter les services:${NC} docker-compose -f docker-compose-minimal.yml down"
echo -e "${BLUE}Pour voir les logs:${NC} docker-compose -f docker-compose-minimal.yml logs -f"