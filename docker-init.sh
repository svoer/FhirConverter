#!/bin/bash

# Script pour initialiser l'environnement Docker complet
# Ce script crée la structure de répertoires pour les volumes docker

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Initialisation de l'environnement Docker complet pour FHIRHub ===${NC}"

# Création des répertoires pour les volumes
echo -e "${YELLOW}Création des répertoires pour les volumes Docker...${NC}"
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana

# Vérification de la création des répertoires
if [ -d "volumes/db" ] && [ -d "volumes/data" ] && [ -d "volumes/logs" ] && [ -d "volumes/backups" ] && [ -d "volumes/french_terminology" ] && [ -d "volumes/prometheus" ] && [ -d "volumes/grafana" ]; then
  echo -e "${GREEN}✓ Structure des répertoires pour les volumes créée avec succès${NC}"
else
  echo -e "${RED}× Erreur lors de la création des répertoires${NC}"
  exit 1
fi

# Création des sous-répertoires de data
echo -e "${YELLOW}Création des sous-répertoires de data...${NC}"
mkdir -p volumes/data/conversions volumes/data/history volumes/data/outputs volumes/data/test volumes/data/workflows

# Configuration des permissions
echo -e "${YELLOW}Configuration des permissions...${NC}"
mkdir -p volumes/prometheus volumes/grafana
chmod -R 777 volumes/prometheus volumes/grafana
chmod -R 755 volumes

# Vérification de la configuration Prometheus
echo -e "${YELLOW}Vérification de la configuration Prometheus...${NC}"
if [ ! -d "prometheus" ]; then
  mkdir -p prometheus
fi

if [ ! -f "prometheus/prometheus.yml" ]; then
  cat > prometheus/prometheus.yml << EOF
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

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          # Alertmanager peut être ajouté ultérieurement si nécessaire
EOF
  echo -e "${GREEN}✓ Configuration Prometheus créée${NC}"
else
  echo -e "${GREEN}✓ Configuration Prometheus existante conservée${NC}"
fi

# Vérification de la configuration Grafana
echo -e "${YELLOW}Vérification de la configuration Grafana...${NC}"
if [ ! -d "grafana/provisioning/datasources" ]; then
  mkdir -p grafana/provisioning/datasources
fi

if [ ! -f "grafana/provisioning/datasources/prometheus.yml" ]; then
  cat > grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
  echo -e "${GREEN}✓ Configuration Grafana Datasources créée${NC}"
else
  echo -e "${GREEN}✓ Configuration Grafana Datasources existante conservée${NC}"
fi

if [ ! -d "grafana/dashboards" ]; then
  mkdir -p grafana/dashboards
fi

if [ ! -f "grafana/dashboards/fhirhub-overview.json" ]; then
  echo -e "${YELLOW}Dashboard Grafana par défaut créé...${NC}"
  cat > grafana/dashboards/fhirhub-overview.json << EOF
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "panels": [
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 24,
        "x": 0,
        "y": 0
      },
      "hiddenSeries": false,
      "id": 2,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "dataLinks": []
      },
      "percentage": false,
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "process_resident_memory_bytes{job=\"fhirhub\"}",
          "interval": "",
          "legendFormat": "Memory",
          "refId": "A"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Mémoire Utilisée",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "bytes",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": "Prometheus",
      "fill": 1,
      "fillGradient": 0,
      "gridPos": {
        "h": 8,
        "w": 24,
        "x": 0,
        "y": 8
      },
      "hiddenSeries": false,
      "id": 4,
      "legend": {
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "show": true,
        "total": false,
        "values": false
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "null",
      "options": {
        "dataLinks": []
      },
      "percentage": false,
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "expr": "fhirhub_conversions_total",
          "interval": "",
          "legendFormat": "Conversions",
          "refId": "A"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Nombre de Conversions",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "label": null,
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    }
  ],
  "schemaVersion": 22,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d"
    ]
  },
  "timezone": "",
  "title": "FHIRHub Overview",
  "uid": "fhirhub-overview",
  "variables": {
    "list": []
  },
  "version": 1
}
EOF
  echo -e "${GREEN}✓ Dashboard Grafana créé${NC}"
else
  echo -e "${GREEN}✓ Dashboard Grafana existant conservé${NC}"
fi

# Message de fin d'initialisation
echo -e "${GREEN}=== Initialisation terminée avec succès ===${NC}"
echo -e "${BLUE}Pour démarrer FHIRHub avec la configuration complète, exécutez:${NC}"
echo -e "${YELLOW}docker-compose up -d${NC}"
echo -e "${BLUE}Pour accéder aux interfaces:${NC}"
echo -e "${YELLOW}- FHIRHub: http://localhost:5000${NC}"
echo -e "${YELLOW}- Prometheus: http://localhost:9090${NC}"
echo -e "${YELLOW}- Grafana: http://localhost:3000${NC}"
echo -e "${BLUE}Identifiants Grafana par défaut:${NC}"
echo -e "${YELLOW}- Utilisateur: admin${NC}"
echo -e "${YELLOW}- Mot de passe: fhirhub-admin${NC}"
echo -e "${BLUE}Identifiants FHIRHub par défaut:${NC}"
echo -e "${YELLOW}- Utilisateur: admin${NC}"
echo -e "${YELLOW}- Mot de passe: adminfhirhub${NC}"
echo -e "${BLUE}=== Fin de l'initialisation ===${NC}"

# Rendre le script exécutable
chmod +x docker-init.sh