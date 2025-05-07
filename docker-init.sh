#!/bin/bash

# Script pour initialiser l'environnement Docker complet
# Ce script crée la structure de répertoires pour les volumes docker et configure Loki et Watchtower

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Initialisation de l'environnement Docker complet pour FHIRHub ===${NC}"

# Création des répertoires pour les volumes
echo -e "${YELLOW}Création des répertoires pour les volumes Docker...${NC}"
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana volumes/loki

# Vérification de la création des répertoires
if [ -d "volumes/db" ] && [ -d "volumes/data" ] && [ -d "volumes/logs" ] && [ -d "volumes/backups" ] && [ -d "volumes/french_terminology" ] && [ -d "volumes/prometheus" ] && [ -d "volumes/grafana" ] && [ -d "volumes/loki" ]; then
  echo -e "${GREEN}✓ Structure des répertoires pour les volumes créée avec succès${NC}"
else
  echo -e "${RED}× Erreur lors de la création des répertoires${NC}"
  exit 1
fi

# Création des sous-répertoires french_terminology
mkdir -p volumes/french_terminology/cache

# Création des sous-répertoires de data
echo -e "${YELLOW}Création des sous-répertoires de data...${NC}"
mkdir -p volumes/data/conversions volumes/data/history volumes/data/outputs volumes/data/test volumes/data/workflows volumes/data/cache volumes/data/ai_responses

# Configuration des permissions
echo -e "${YELLOW}Configuration des permissions...${NC}"
mkdir -p volumes/prometheus volumes/grafana volumes/grafana/logs volumes/grafana/plugins

# Créer des répertoires supplémentaires pour Prometheus
mkdir -p volumes/prometheus/data
touch volumes/prometheus/queries.active

# S'assurer que les répertoires existent pour Grafana
mkdir -p volumes/grafana/plugins
mkdir -p volumes/grafana/dashboards
mkdir -p volumes/grafana/data

# Créer des répertoires pour Loki et Promtail
echo -e "${YELLOW}Création des répertoires pour Loki et Promtail...${NC}"
mkdir -p loki promtail
mkdir -p volumes/loki/chunks volumes/loki/index volumes/loki/wal volumes/loki/compactor

# Permissions spéciales pour Prometheus, Grafana et Loki
# Ajuster pour fonctionner avec docker-compose.full.yml qui utilise user: "root"
echo -e "${BLUE}Configuration des permissions pour utilisation avec docker...${NC}"

# Définir les permissions les plus larges possibles pour éviter les problèmes
chmod -R 777 volumes/prometheus
chmod -R 777 volumes/grafana
chmod -R 777 volumes/grafana/plugins
chmod -R 777 volumes/grafana/logs
chmod -R 777 volumes/grafana/data
chmod -R 777 volumes/loki
chmod 777 volumes/prometheus/queries.active

echo -e "${GREEN}✓ Permissions configurées avec succès${NC}"
echo -e "${BLUE}Note: Utilisez ces commandes après démarrage si vous avez toujours des problèmes:${NC}"
echo -e "${YELLOW}docker exec -it fhirhub-grafana chown -R grafana:grafana /var/lib/grafana${NC}"
echo -e "${YELLOW}docker exec -it fhirhub-prometheus chown -R nobody:nobody /prometheus${NC}"
echo -e "${YELLOW}docker exec -it fhirhub-loki chown -R loki:loki /loki${NC}"

# Permissions pour le socket Docker (pour Watchtower)
if [ -e /var/run/docker.sock ]; then
  echo -e "${YELLOW}Configuration des permissions du socket Docker pour Watchtower...${NC}"
  chmod 666 /var/run/docker.sock 2>/dev/null || echo -e "${YELLOW}Vous devrez peut-être exécuter cette commande avec sudo: sudo chmod 666 /var/run/docker.sock${NC}"
fi

# Permissions générales pour les autres volumes
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

# Vérification et configuration de Loki
echo -e "${YELLOW}Vérification de la configuration Loki...${NC}"
if [ ! -d "loki" ]; then
  mkdir -p loki
fi

if [ ! -f "loki/loki-config.yaml" ]; then
  cat > loki/loki-config.yaml << EOF
auth_enabled: false

server:
  http_listen_port: 3100
  log_level: info

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  chunk_retain_period: 30s
  max_chunk_age: 1h
  wal:
    enabled: true
    dir: /loki/wal

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    cache_ttl: 24h
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/compactor

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  split_queries_by_interval: 15m
  max_query_parallelism: 32
  max_look_back_period: 0

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

query_range:
  align_queries_with_step: true
  max_retries: 5
  cache_results: true
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100
EOF
  echo -e "${GREEN}✓ Configuration Loki créée${NC}"
else
  echo -e "${GREEN}✓ Configuration Loki existante conservée${NC}"
fi

# Vérification et configuration de Promtail
echo -e "${YELLOW}Vérification de la configuration Promtail...${NC}"
if [ ! -d "promtail" ]; then
  mkdir -p promtail
fi

if [ ! -f "promtail/promtail-config.yaml" ]; then
  cat > promtail/promtail-config.yaml << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: fhirhub-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: fhirhub-logs
          __path__: /var/log/fhirhub/*.log
    
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            service: service
            application: application
      - timestamp:
          source: timestamp
          format: RFC3339
      - labels:
          level:
          service:
          application:
      - output:
          source: message

  - job_name: fhirhub-conversion-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: fhirhub-conversion
          __path__: /var/log/fhirhub/conversion*.log
    
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            status: status
            input: input
            output: output
            error: error
            applicationId: applicationId
            duration: duration
      - timestamp:
          source: timestamp
          format: RFC3339
      - labels:
          status:
          applicationId:
      - output:
          source: message
EOF
  echo -e "${GREEN}✓ Configuration Promtail créée${NC}"
else
  echo -e "${GREEN}✓ Configuration Promtail existante conservée${NC}"
fi

# Vérification et création du fichier de configuration unifié pour les datasources Grafana
echo -e "${YELLOW}Configuration des sources de données Grafana...${NC}"
if [ ! -f "grafana/provisioning/datasources/unified-datasources.yml" ]; then
  cat > grafana/provisioning/datasources/unified-datasources.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: FHIRHub Logs
    type: simplejson
    access: proxy
    url: http://fhirhub:9091/api/logs
    isDefault: false
    editable: true
    jsonData:
      timeField: "timestamp"
      
  - name: Loki
    type: loki
    access: proxy
    url: http://fhirhub:9091/loki
    isDefault: false
    editable: true
    jsonData:
      maxLines: 1000
      
  - name: Conversion Logs
    type: simplejson
    access: proxy
    url: http://fhirhub:9091/conversion-logs
    isDefault: false
    editable: true
    jsonData:
      timeField: "timestamp"
EOF
  echo -e "${GREEN}✓ Configuration unifiée des sources de données Grafana créée${NC}"
else
  echo -e "${GREEN}✓ Configuration unifiée des sources de données Grafana existante conservée${NC}"
fi

# Message de fin d'initialisation avec Loki et Watchtower
echo -e "${GREEN}=== Initialisation terminée avec succès ===${NC}"
echo -e "${BLUE}Pour démarrer FHIRHub avec la configuration complète, exécutez:${NC}"
echo -e "${YELLOW}docker-compose up -d${NC}"
echo -e "${BLUE}Pour accéder aux interfaces:${NC}"
echo -e "${YELLOW}- FHIRHub: http://localhost:5000${NC}"
echo -e "${YELLOW}- Prometheus: http://localhost:9092${NC}"
echo -e "${YELLOW}- Grafana: http://localhost:3000${NC}"
echo -e "${YELLOW}- Loki: http://localhost:3100${NC}"
echo -e "${BLUE}Services installés:${NC}"
echo -e "${YELLOW}- FHIRHub: Application principale${NC}"
echo -e "${YELLOW}- Prometheus: Collecte des métriques${NC}"
echo -e "${YELLOW}- Grafana: Tableaux de bord et visualisation${NC}"
echo -e "${YELLOW}- Loki: Collecte et analyse des logs${NC}"
echo -e "${YELLOW}- Promtail: Agent de collecte des logs pour Loki${NC}"
echo -e "${YELLOW}- Watchtower: Mises à jour automatiques des conteneurs${NC}"
echo -e "${BLUE}Identifiants par défaut:${NC}"
echo -e "${YELLOW}- Grafana: admin / admin123${NC}"
echo -e "${YELLOW}- FHIRHub: admin / admin123${NC}"
echo -e "${BLUE}=== Fin de l'initialisation ===${NC}"
echo -e "${BLUE}Note: Pour appliquer les permissions correctement, exécutez:${NC}"
echo -e "${YELLOW}./fix-docker-loki-permissions.sh${NC}"

# Rendre le script exécutable
chmod +x docker-init.sh