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
    
  # Simplejson datasource pour les logs d'application FHIRHub - simple et sans dépendances
  - name: FHIRHub Logs
    type: prometheus
    access: proxy
    url: http://prometheus:9090/api/v1/query
    isDefault: false
    editable: true
    jsonData:
      timeInterval: "30s"
EOF
  echo -e "${GREEN}✅ Configuration des datasources Grafana créée${NC}"
fi

# Vérifier et copier les tableaux de bord existants
echo -e "${BLUE}Vérification des tableaux de bord Grafana avancés...${NC}"

# Créer le répertoire de dashboards si nécessaire
mkdir -p ./grafana/dashboards

# Copier les tableaux de bord existants s'ils existent
DASHBOARD_COUNT=0

# Copier le tableau de bord conversion-logs-dashboard.json s'il existe
if [ -f "./grafana/dashboards/conversion-logs-dashboard.json" ]; then
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'conversion-logs-dashboard.json' trouvé${NC}"
else
  echo -e "${YELLOW}Création du tableau de bord pour les logs de conversion...${NC}"
  cat > ./grafana/dashboards/conversion-logs-dashboard.json << 'EOF'
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
  "id": 2,
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
            "mode": "thresholds"
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
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "9.3.1",
      "title": "Total des conversions",
      "type": "stat"
    },
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
            "fillOpacity": 0,
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
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 10,
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
      "title": "Temps de conversion",
      "type": "timeseries"
    },
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
            "fillOpacity": 0,
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
        "y": 8
      },
      "id": 8,
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
      "title": "Conversions par jour",
      "type": "timeseries"
    },
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
            "fillOpacity": 0,
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
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 8
      },
      "id": 6,
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
      "title": "Ressources par conversion",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "custom": {
            "align": "auto",
            "displayMode": "auto",
            "inspect": false
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
        "w": 24,
        "x": 0,
        "y": 16
      },
      "id": 4,
      "options": {
        "footer": {
          "fields": "",
          "reducer": [
            "sum"
          ],
          "show": false
        },
        "showHeader": true
      },
      "pluginVersion": "9.3.1",
      "title": "Dernières conversions",
      "type": "table"
    }
  ],
  "refresh": "",
  "schemaVersion": 37,
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
  "title": "Logs de Conversion FHIRHub",
  "uid": "JjQnz1Q7z",
  "version": 1,
  "weekStart": ""
}
EOF
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'conversion-logs-dashboard.json' créé${NC}"
fi

# Copier le tableau de bord fhirhub-overview.json s'il existe
if [ -f "./grafana/dashboards/fhirhub-overview.json" ]; then
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'fhirhub-overview.json' trouvé${NC}"
else
  echo -e "${YELLOW}Création du tableau de bord de vue d'ensemble FHIRHub...${NC}"
  cat > ./grafana/dashboards/fhirhub-overview.json << 'EOF'
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
            "mode": "thresholds"
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
        "w": 8,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "9.3.1",
      "title": "Santé du système",
      "type": "stat"
    },
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
            "fillOpacity": 0,
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
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 8,
        "x": 8,
        "y": 0
      },
      "id": 3,
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
      "title": "Utilisation mémoire",
      "type": "timeseries"
    },
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
            "fillOpacity": 0,
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
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 8,
        "x": 16,
        "y": 0
      },
      "id": 5,
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
      "title": "Utilisation CPU",
      "type": "timeseries"
    }
  ],
  "refresh": "5s",
  "schemaVersion": 37,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-30m",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "Vue d'ensemble FHIRHub",
  "uid": "I75yqvP4k",
  "version": 1,
  "weekStart": ""
}
EOF
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'fhirhub-overview.json' créé${NC}"
fi

# Copier le tableau de bord logs_detailed_dashboard.json s'il existe
if [ -f "./grafana/dashboards/logs_detailed_dashboard.json" ]; then
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'logs_detailed_dashboard.json' trouvé${NC}"
else
  echo -e "${YELLOW}Création du tableau de bord détaillé des logs...${NC}"
  cat > ./grafana/dashboards/logs_detailed_dashboard.json << 'EOF'
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "datasource",
          "uid": "grafana"
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
  "id": 3,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "description": "Vue détaillée des logs des conversions avec filtrage par application, date et niveau d'erreur",
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "custom": {
            "align": "auto",
            "displayMode": "auto",
            "filterable": true,
            "inspect": false
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              }
            ]
          }
        },
        "overrides": [
          {
            "matcher": {
              "id": "byName",
              "options": "Niveau"
            },
            "properties": [
              {
                "id": "color",
                "value": {
                  "fixedColor": "semi-dark-red",
                  "mode": "fixed"
                }
              }
            ]
          }
        ]
      },
      "gridPos": {
        "h": 12,
        "w": 24,
        "x": 0,
        "y": 0
      },
      "id": 2,
      "options": {
        "footer": {
          "fields": "",
          "reducer": [
            "sum"
          ],
          "show": false
        },
        "showHeader": true,
        "sortBy": [
          {
            "desc": true,
            "displayName": "Timestamp"
          }
        ]
      },
      "pluginVersion": "9.3.1",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "PBFA97CFB590B2093"
          },
          "editorMode": "code",
          "expr": "metric_conversion_time_total",
          "legendFormat": "__auto",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Logs détaillés des conversions",
      "type": "table"
    },
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
            "fillOpacity": 0,
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
        "y": 12
      },
      "id": 4,
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
      "title": "Distribution des erreurs par application",
      "type": "timeseries"
    },
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
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            }
          },
          "mappings": []
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 12
      },
      "id": 6,
      "options": {
        "legend": {
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "pieType": "pie",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "title": "Répartition des types d'erreurs",
      "type": "piechart"
    }
  ],
  "refresh": "5s",
  "schemaVersion": 37,
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
  "title": "Logs détaillés FHIRHub",
  "uid": "73nzqnP4a",
  "version": 1,
  "weekStart": ""
}
EOF
  DASHBOARD_COUNT=$((DASHBOARD_COUNT + 1))
  echo -e "${GREEN}✓ Tableau de bord 'logs_detailed_dashboard.json' créé${NC}"
fi

echo -e "${GREEN}Un total de $DASHBOARD_COUNT tableaux de bord Grafana ont été configurés${NC}"

# Vérifier si le dossier french_terminology existe et le créer si nécessaire
if [ ! -d "./data/french_terminology" ]; then
  echo -e "${YELLOW}Création du répertoire pour les terminologies françaises...${NC}"
  mkdir -p ./data/french_terminology
  
  # Copier les terminologies françaises depuis le dossier source si elles existent
  if [ -d "./french_terminology" ]; then
    echo -e "${YELLOW}Copie des terminologies françaises existantes...${NC}"
    cp -r ./french_terminology/* ./data/french_terminology/
    echo -e "${GREEN}✅ Terminologies françaises copiées dans le volume Docker${NC}"
  else
    echo -e "${YELLOW}⚠️ Dossier french_terminology non trouvé. Les terminologies françaises ne seront pas disponibles.${NC}"
    echo -e "${YELLOW}⚠️ Vous pouvez les ajouter manuellement dans le dossier ./data/french_terminology${NC}"
  fi
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