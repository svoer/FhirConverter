#!/bin/bash

# Script pour corriger les permissions des volumes Loki, Promtail et Watchtower
# À exécuter avec sudo si nécessaire

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}  Correction des permissions pour Loki et Promtail${NC}"
echo -e "${BLUE}====================================================${NC}"

# Créer les répertoires s'ils n'existent pas
echo -e "${YELLOW}Création des répertoires nécessaires...${NC}"
mkdir -p ./volumes/loki
mkdir -p ./loki
mkdir -p ./promtail

# Définir les permissions pour les volumes Loki
echo -e "${YELLOW}Configuration des permissions pour Loki...${NC}"
chmod -R 777 ./volumes/loki
chmod -R 777 ./loki
chmod -R 777 ./promtail

# Vérifier et créer les fichiers de configuration s'ils n'existent pas
if [ ! -f "./loki/loki-config.yaml" ]; then
    echo -e "${YELLOW}Création du fichier de configuration Loki...${NC}"
    cat > ./loki/loki-config.yaml << EOF
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
    - from: 2023-01-01
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
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  split_queries_by_interval: 15m
  max_query_parallelism: 32

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

query_range:
  align_queries_with_step: true
  max_retries: 5
  cache_results: true
  results_cache:
    cache:
      enable_fifocache: true
      fifocache:
        max_size_items: 1024
        validity: 24h
EOF
    echo -e "${GREEN}✓ Fichier de configuration Loki créé${NC}"
fi

if [ ! -f "./promtail/promtail-config.yaml" ]; then
    echo -e "${YELLOW}Création du fichier de configuration Promtail...${NC}"
    cat > ./promtail/promtail-config.yaml << EOF
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
    echo -e "${GREEN}✓ Fichier de configuration Promtail créé${NC}"
fi

# Ajuster les permissions du socket Docker pour Watchtower
if [ -e /var/run/docker.sock ]; then
    echo -e "${YELLOW}Configuration des permissions du socket Docker pour Watchtower...${NC}"
    chmod 666 /var/run/docker.sock 2>/dev/null || echo -e "${YELLOW}Impossible de modifier les permissions du socket Docker - vous devrez peut-être exécuter cette commande avec sudo${NC}"
fi

echo -e "${GREEN}✓ Configuration des permissions terminée${NC}"
echo -e "${BLUE}Pour appliquer les modifications, redémarrez les services Docker :${NC}"
echo -e "${YELLOW}docker-compose down${NC}"
echo -e "${YELLOW}docker-compose up -d${NC}"
echo -e "${BLUE}====================================================${NC}"

exit 0