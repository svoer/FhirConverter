#!/bin/bash

# Script d'installation complet pour FHIRHub
# Ce script configure l'environnement Docker, crée les répertoires, les fichiers de configuration,
# et démarre les services en une seule opération.

# Couleurs pour une meilleure lisibilité
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages d'information
info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

# Fonction pour afficher les avertissements
warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Fonction pour afficher les erreurs
error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Vérification des privilèges root
if [ "$EUID" -ne 0 ]; then
  error "Merci d'exécuter ce script en tant que root ou avec sudo"
fi

# Vérification que Docker est installé
if ! command -v docker &> /dev/null; then
  error "Docker n'est pas installé. Veuillez installer Docker avant de continuer."
fi

# Vérification que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
  warn "Docker Compose n'est pas installé. Tentative d'installation..."
  apt-get update
  apt-get install -y docker-compose
  if [ $? -ne 0 ]; then
    error "Impossible d'installer Docker Compose. Veuillez l'installer manuellement."
  fi
fi

# Répertoire de base (où le docker-compose.yml est situé)
BASE_DIR="$(pwd)"
info "Répertoire de base: $BASE_DIR"

# Création des utilisateurs et groupes pour les conteneurs
info "Création des utilisateurs et groupes système..."

# Création des variables d'utilisateurs et groupes pour les conteneurs
APP_UID=${APP_UID:-1000}
APP_GID=${APP_GID:-1000}
PROM_UID=${PROM_UID:-65534}
PROM_GID=${PROM_GID:-65534}
GRAFANA_UID=${GRAFANA_UID:-472}
GRAFANA_GID=${GRAFANA_GID:-472}
NODE_EXP_UID=${NODE_EXP_UID:-65534}
NODE_EXP_GID=${NODE_EXP_GID:-65534}
LOKI_UID=${LOKI_UID:-10001}
LOKI_GID=${LOKI_GID:-10001}
PROMTAIL_UID=${PROMTAIL_UID:-10002}
PROMTAIL_GID=${PROMTAIL_GID:-10002}
BACKUP_UID=${BACKUP_UID:-10003}
BACKUP_GID=${BACKUP_GID:-10003}

# Création des groupes nécessaires s'ils n'existent pas déjà
create_group() {
  if ! getent group $2 > /dev/null; then
    groupadd -g $2 $1
    info "Groupe $1 créé avec GID $2"
  else
    warn "Groupe $1 (GID: $2) existe déjà"
  fi
}

# Création des utilisateurs nécessaires s'ils n'existent pas déjà
create_user() {
  if ! getent passwd $1 > /dev/null; then
    useradd -u $2 -g $3 -s /sbin/nologin -M $1
    info "Utilisateur $1 créé avec UID $2 et GID $3"
  else
    warn "Utilisateur $1 (UID: $2) existe déjà"
  fi
}

# Création des groupes
create_group "fhirhub" $APP_GID
create_group "prometheus" $PROM_GID
create_group "grafana" $GRAFANA_GID
create_group "nodeexporter" $NODE_EXP_GID
create_group "loki" $LOKI_GID
create_group "promtail" $PROMTAIL_GID 
create_group "fhirbackup" $BACKUP_GID

# Création des utilisateurs
create_user "fhirhub" $APP_UID $APP_GID
create_user "prometheus" $PROM_UID $PROM_GID
create_user "grafana" $GRAFANA_UID $GRAFANA_GID
create_user "nodeexporter" $NODE_EXP_UID $NODE_EXP_GID
create_user "loki" $LOKI_UID $LOKI_GID
create_user "promtail" $PROMTAIL_UID $PROMTAIL_GID
create_user "fhirbackup" $BACKUP_UID $BACKUP_GID

# Fonction pour créer les répertoires avec les bonnes permissions
create_directory() {
  local dir="$1"
  local owner="$2"
  local group="$3"
  local perms="$4"
  
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    info "Répertoire créé: $dir"
  else
    info "Répertoire existant: $dir"
  fi
  
  chown "$owner:$group" "$dir"
  chmod "$perms" "$dir"
  info "Permissions définies pour $dir: propriétaire=$owner, groupe=$group, droits=$perms"
}

# Création de la structure de répertoires
info "Création de la structure de répertoires..."

# Répertoires de données
create_directory "$BASE_DIR/data" "root" "root" "755"
create_directory "$BASE_DIR/data/db" "$APP_UID" "$APP_GID" "750"
create_directory "$BASE_DIR/data/storage" "$APP_UID" "$APP_GID" "750"
create_directory "$BASE_DIR/data/logs" "$APP_UID" "$APP_GID" "750"
create_directory "$BASE_DIR/data/backups" "$BACKUP_UID" "$BACKUP_GID" "750"
create_directory "$BASE_DIR/data/french_terminology" "$APP_UID" "$APP_GID" "750"
create_directory "$BASE_DIR/data/prometheus" "$PROM_UID" "$PROM_GID" "750"
create_directory "$BASE_DIR/data/grafana" "$GRAFANA_UID" "$GRAFANA_GID" "750"
create_directory "$BASE_DIR/data/loki" "$LOKI_UID" "$LOKI_GID" "750"

# Répertoires de configuration
create_directory "$BASE_DIR/config" "root" "root" "755"
create_directory "$BASE_DIR/config/prometheus" "root" "root" "755"
create_directory "$BASE_DIR/config/grafana" "root" "root" "755"
create_directory "$BASE_DIR/config/grafana/provisioning" "root" "root" "755"
create_directory "$BASE_DIR/config/grafana/dashboards" "root" "root" "755"
create_directory "$BASE_DIR/config/loki" "root" "root" "755"
create_directory "$BASE_DIR/config/promtail" "root" "root" "755"
create_directory "$BASE_DIR/config/nginx" "root" "root" "755"
create_directory "$BASE_DIR/config/nginx/conf.d" "root" "root" "755"

# Répertoires pour Nginx
create_directory "$BASE_DIR/data/nginx" "root" "root" "755"
create_directory "$BASE_DIR/data/nginx/logs" "root" "root" "755"
create_directory "$BASE_DIR/data/nginx/ssl" "root" "root" "755"
create_directory "$BASE_DIR/data/nginx/certbot" "root" "root" "755"
create_directory "$BASE_DIR/data/nginx/certbot/conf" "root" "root" "755"
create_directory "$BASE_DIR/data/nginx/certbot/www" "root" "root" "755"

# Répertoire pour les scripts
create_directory "$BASE_DIR/scripts" "root" "root" "755"

# Création du fichier .env avec des valeurs par défaut sécurisées
if [ ! -f "$BASE_DIR/.env" ]; then
  info "Création du fichier .env avec des valeurs par défaut sécurisées..."
  cat > "$BASE_DIR/.env" << EOF

# Création des scripts de gestion des services
info "Création des scripts de gestion des services..."

# Script de démarrage des services
cat > "$BASE_DIR/start.sh" << 'EOF'
#!/bin/bash

# Script pour démarrer les services FHIRHub
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Démarrage des services FHIRHub...${NC}"
docker-compose up -d

echo -e "${GREEN}Attente du démarrage des services...${NC}"
sleep 5

echo -e "${GREEN}État des services:${NC}"
docker-compose ps

echo -e "${GREEN}Services démarrés avec succès!${NC}"
echo ""
echo -e "${YELLOW}Services accessibles:${NC}"
echo -e "FHIRHub: http://$(hostname -I | awk '{print $1}')"
echo -e "Grafana: http://$(hostname -I | awk '{print $1}')/grafana"
echo -e "Prometheus: http://$(hostname -I | awk '{print $1}')/prometheus"
echo ""
echo -e "${YELLOW}Pour activer HTTPS, exécutez:${NC} ./setup-ssl.sh"
echo -e "${YELLOW}Pour vérifier l'état des services:${NC} ./status.sh"
echo -e "${YELLOW}Pour effectuer une sauvegarde manuelle:${NC} ./backup-now.sh"
EOF

chmod 755 "$BASE_DIR/start.sh"
info "Script de démarrage créé et rendu exécutable"

# Script d'arrêt des services
cat > "$BASE_DIR/stop.sh" << 'EOF'
#!/bin/bash

# Script pour arrêter les services FHIRHub
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Arrêt des services FHIRHub...${NC}"
docker-compose down

echo -e "${GREEN}Services arrêtés avec succès!${NC}"
EOF

chmod 755 "$BASE_DIR/stop.sh"
info "Script d'arrêt créé et rendu exécutable"

# Script de vérification de l'état des services
cat > "$BASE_DIR/status.sh" << 'EOF'
#!/bin/bash

# Script pour vérifier l'état des services FHIRHub
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}État des services:${NC}"
docker-compose ps

echo -e "\n${GREEN}Utilisation des ressources:${NC}"
docker stats --no-stream $(docker-compose ps -q 2>/dev/null)

echo -e "\n${GREEN}Espace disque utilisé:${NC}"
du -sh ./data 2>/dev/null || echo "Aucune donnée trouvée"

echo -e "\n${GREEN}Sauvegardes disponibles:${NC}"
ls -lh ./data/backups/fhirhub-backup-*.tar.gz 2>/dev/null || echo "Aucune sauvegarde trouvée"

echo -e "\n${GREEN}Journaux des services:${NC}"
echo "Pour voir les journaux d'un service spécifique: docker-compose logs [service]"
echo "Services disponibles: fhirhub, nginx, prometheus, grafana, loki, promtail, node-exporter, watchtower, backup"
EOF

chmod 755 "$BASE_DIR/status.sh"
info "Script de vérification de l'état créé et rendu exécutable"

# Script de sauvegarde manuelle
cat > "$BASE_DIR/backup-now.sh" << 'EOF'
#!/bin/bash

# Script pour lancer une sauvegarde manuelle
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Lancement d'une sauvegarde manuelle...${NC}"
docker exec fhirhub-backup /scripts/backup.sh
echo -e "${GREEN}Sauvegarde terminée${NC}"
EOF

chmod 755 "$BASE_DIR/backup-now.sh"
info "Script de sauvegarde manuelle créé et rendu exécutable"

# Script de restauration
cat > "$BASE_DIR/restore.sh" << 'EOF'
#!/bin/bash

# Script pour restaurer une sauvegarde
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ $# -ne 1 ]; then
  echo -e "${RED}Usage: $0 <chemin_vers_sauvegarde.tar.gz>${NC}"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Erreur: Le fichier de sauvegarde n'existe pas: $BACKUP_FILE${NC}"
  exit 1
fi

echo -e "${YELLOW}Restauration de la sauvegarde: $BACKUP_FILE${NC}"

# Arrêt des services pour éviter les corruptions
echo -e "${YELLOW}Arrêt des services...${NC}"
docker-compose down

# Extraction de la sauvegarde
echo -e "${YELLOW}Extraction de la sauvegarde...${NC}"
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Le fichier de sauvegarde contient un répertoire backup-YYYYMMDD-HHMMSS
BACKUP_DIR=$(ls -1 "$TEMP_DIR" | grep "backup-" | head -1)

if [ -z "$BACKUP_DIR" ]; then
  echo -e "${RED}Erreur: Format de sauvegarde invalide${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Restauration des fichiers
echo -e "${YELLOW}Restauration des fichiers...${NC}"

# Restauration de la base de données
if [ -f "$TEMP_DIR/$BACKUP_DIR/fhirhub.db" ]; then
  cp -a "$TEMP_DIR/$BACKUP_DIR/fhirhub.db" "./data/db/fhirhub.db"
  echo -e "${GREEN}Base de données restaurée${NC}"
fi

# Restauration des données
if [ -f "$TEMP_DIR/$BACKUP_DIR/storage.tar.gz" ]; then
  tar -xzf "$TEMP_DIR/$BACKUP_DIR/storage.tar.gz" -C "./data/"
  echo -e "${GREEN}Données de stockage restaurées${NC}"
fi

if [ -f "$TEMP_DIR/$BACKUP_DIR/french_terminology.tar.gz" ]; then
  tar -xzf "$TEMP_DIR/$BACKUP_DIR/french_terminology.tar.gz" -C "./data/"
  echo -e "${GREEN}Terminologies françaises restaurées${NC}"
fi

# Correction des permissions
echo -e "${YELLOW}Correction des permissions...${NC}"
source ./.env
chown -R $APP_UID:$APP_GID ./data/db
chown -R $APP_UID:$APP_GID ./data/storage
chown -R $APP_UID:$APP_GID ./data/french_terminology

# Nettoyage
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Restauration terminée. Vous pouvez maintenant redémarrer les services avec './start.sh'${NC}"
EOF

chmod 755 "$BASE_DIR/restore.sh"
info "Script de restauration créé et rendu exécutable"

# Démarrage des services
info "Démarrage des services..."
docker-compose up -d

info "\n=== Installation terminée avec succès! ==="
info "Vos services FHIRHub sont maintenant opérationnels."
info "Accès aux services:"
info "- FHIRHub: http://$(hostname -I | awk '{print $1}')"
info "- Grafana: http://$(hostname -I | awk '{print $1}')/grafana"
info "- Prometheus: http://$(hostname -I | awk '{print $1}')/prometheus"
info ""
info "Autres commandes disponibles:"
info "- './start.sh': Démarrer les services"
info "- './stop.sh': Arrêter les services"
info "- './status.sh': Vérifier l'état des services"
info "- './backup-now.sh': Effectuer une sauvegarde manuelle"
info "- './restore.sh <fichier>': Restaurer une sauvegarde"
info "- './setup-ssl.sh': Configurer HTTPS avec un certificat auto-signé"
info ""
info "IMPORTANT: Pour sécuriser davantage votre installation, exécutez './setup-ssl.sh'"
info "pour activer HTTPS. Cela créera un certificat SSL auto-signé."
info ""
info "Les identifiants Grafana par défaut sont:"
info "- Utilisateur: admin"
info "- Mot de passe: $(grep "GRAFANA_PASSWORD" "$BASE_DIR/.env" | cut -d= -f2)"
info ""
info "N'oubliez pas de changer ces identifiants après votre première connexion!"
# Variables d'environnement pour FHIRHub
JWT_SECRET=$(openssl rand -hex 32)
GRAFANA_USER=admin
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# UID/GID des utilisateurs pour les services
APP_UID=$APP_UID
APP_GID=$APP_GID
PROM_UID=$PROM_UID
PROM_GID=$PROM_GID
GRAFANA_UID=$GRAFANA_UID
GRAFANA_GID=$GRAFANA_GID
NODE_EXP_UID=$NODE_EXP_UID
NODE_EXP_GID=$NODE_EXP_GID
LOKI_UID=$LOKI_UID
LOKI_GID=$LOKI_GID
PROMTAIL_UID=$PROMTAIL_UID
PROMTAIL_GID=$PROMTAIL_GID
BACKUP_UID=$BACKUP_UID
BACKUP_GID=$BACKUP_GID

# Configuration des notifications Watchtower
# Format: shoutrrr://telegram?token=XXX&chatid=YYY
WATCHTOWER_NOTIFICATION_URL=

# Rétention des sauvegardes (jours)
BACKUP_RETENTION=14
EOF
  chmod 600 "$BASE_DIR/.env"
  info "Fichier .env créé et sécurisé"
else
  warn "Le fichier .env existe déjà, il n'a pas été modifié"
fi

# Création des fichiers de configuration

# Configuration Prometheus
info "Création de la configuration Prometheus..."
cat > "$BASE_DIR/config/prometheus/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'fhirhub'
    static_configs:
      - targets: ['fhirhub:9091']
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

# Configuration Loki
info "Création de la configuration Loki..."
cat > "$BASE_DIR/config/loki/loki-config.yaml" << EOF
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s

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
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
EOF

# Configuration Promtail
info "Création de la configuration Promtail..."
cat > "$BASE_DIR/config/promtail/promtail-config.yaml" << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: fhirhub_logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: fhirhub_logs
          __path__: /var/log/fhirhub/*.log
EOF

# Configuration Nginx
info "Création de la configuration Nginx..."
cat > "$BASE_DIR/config/nginx/nginx.conf" << EOF
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                      '\$status \$body_bytes_sent "\$http_referer" '
                      '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    keepalive_timeout  65;

    #gzip  on;

    include /etc/nginx/conf.d/*.conf;
}
EOF

# Obtention de l'adresse IP du serveur
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  warn "Impossible de déterminer l'adresse IP du serveur."
  SERVER_IP="localhost"
fi

info "Configuration de Nginx pour l'adresse IP: $SERVER_IP"

# Configuration site Nginx
cat > "$BASE_DIR/config/nginx/conf.d/default.conf" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_IP localhost;
    
    # Redirection vers HTTPS (à activer après génération du certificat SSL)
    # location / {
    #     return 301 https://\$host\$request_uri;
    # }
    
    # Configuration HTTP (à enlever après activation de HTTPS)
    location / {
        proxy_pass http://fhirhub:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /grafana/ {
        proxy_pass http://grafana:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Configuration spécifique à Grafana
        proxy_set_header Authorization "";
        sub_filter_once off;
        sub_filter 'href="/' 'href="/grafana/';
        sub_filter 'src="/' 'src="/grafana/';
    }
    
    location /prometheus/ {
        proxy_pass http://prometheus:9090/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Configuration spécifique à Prometheus
        sub_filter_once off;
        sub_filter 'href="/' 'href="/prometheus/';
        sub_filter 'src="/' 'src="/prometheus/';
    }
}

# Configuration HTTPS (commentée par défaut, à activer si vous générez un certificat SSL)
# server {
#     listen 443 ssl;
#     listen [::]:443 ssl;
#     server_name $SERVER_IP localhost;
#     
#     # Certificats SSL (à générer avec le script setup-ssl.sh)
#     ssl_certificate /etc/nginx/ssl/fullchain.pem;
#     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
#     
#     # Configuration SSL de base
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_prefer_server_ciphers on;
#     ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
#     ssl_session_timeout 1d;
#     ssl_session_cache shared:SSL:10m;
#     
#     # En-têtes de sécurité
#     add_header X-Content-Type-Options nosniff;
#     add_header X-Frame-Options SAMEORIGIN;
#     add_header X-XSS-Protection "1; mode=block";
#     
#     # Proxy pour FHIRHub
#     location / {
#         proxy_pass http://fhirhub:5000;
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#         proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto \$scheme;
#     }
#     
#     # Proxy pour Grafana
#     location /grafana/ {
#         proxy_pass http://grafana:3000/;
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#         proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto \$scheme;
#         
#         # Configuration spécifique à Grafana
#         proxy_set_header Authorization "";
#         sub_filter_once off;
#         sub_filter 'href="/' 'href="/grafana/';
#         sub_filter 'src="/' 'src="/grafana/';
#     }
#     
#     # Proxy pour Prometheus
#     location /prometheus/ {
#         proxy_pass http://prometheus:9090/;
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#         proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto \$scheme;
#         
#         # Configuration spécifique à Prometheus
#         sub_filter_once off;
#         sub_filter 'href="/' 'href="/prometheus/';
#         sub_filter 'src="/' 'src="/prometheus/';
#     }
# }
EOF

# Création du script de sauvegarde
info "Création du script de sauvegarde..."
cat > "$BASE_DIR/scripts/backup.sh" << 'EOF'
#!/bin/bash

# Script de sauvegarde automatique pour FHIRHub
DATE=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="/backups"
DATA_DIR="/data"
RETENTION_DAYS=${BACKUP_RETENTION:-14}

# Création du répertoire de sauvegarde avec la date
BACKUP_PATH="${BACKUP_DIR}/backup-${DATE}"
mkdir -p "${BACKUP_PATH}"

# Sauvegarde des bases de données
echo "Sauvegarde des bases de données..."
if [ -f "${DATA_DIR}/db/fhirhub.db" ]; then
  cp -a "${DATA_DIR}/db/fhirhub.db" "${BACKUP_PATH}/fhirhub.db"
fi

# Sauvegarde des données importantes
echo "Sauvegarde des données..."
tar -czf "${BACKUP_PATH}/storage.tar.gz" -C "${DATA_DIR}" storage
tar -czf "${BACKUP_PATH}/french_terminology.tar.gz" -C "${DATA_DIR}" french_terminology

# Création d'un fichier unique pour toute la sauvegarde
echo "Création de l'archive finale..."
tar -czf "${BACKUP_DIR}/fhirhub-backup-${DATE}.tar.gz" -C "${BACKUP_DIR}" "backup-${DATE}"

# Suppression du répertoire temporaire
rm -rf "${BACKUP_PATH}"

# Suppression des anciennes sauvegardes
echo "Nettoyage des anciennes sauvegardes..."
find "${BACKUP_DIR}" -name "fhirhub-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "Sauvegarde terminée: ${BACKUP_DIR}/fhirhub-backup-${DATE}.tar.gz"
EOF

chmod 755 "$BASE_DIR/scripts/backup.sh"
info "Script de sauvegarde créé et rendu exécutable"

# Création du script de configuration SSL
info "Création du script de configuration SSL..."
cat > "$BASE_DIR/setup-ssl.sh" << 'EOF'
#!/bin/bash

# Script pour configurer Nginx avec un certificat auto-signé
# Fonctionne avec une adresse IP (pas besoin de nom de domaine)

# Couleurs pour une meilleure lisibilité
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Répertoires pour SSL et Nginx
ssl_path="./data/nginx/ssl"
nginx_conf_path="./config/nginx/conf.d"

# Création des répertoires nécessaires
mkdir -p "$ssl_path"
mkdir -p "$nginx_conf_path"

# Obtention de l'adresse IP du serveur
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  echo -e "${RED}Erreur: Impossible de déterminer l'adresse IP du serveur.${NC}"
  echo "Veuillez spécifier manuellement l'adresse IP:"
  read -r SERVER_IP
  if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}Aucune adresse IP fournie. Utilisation de 'localhost' par défaut.${NC}"
    SERVER_IP="localhost"
  fi
fi

echo -e "${GREEN}Configuration de Nginx avec HTTPS pour l'adresse IP: $SERVER_IP${NC}"

# Création du certificat auto-signé
echo -e "${GREEN}Création d'un certificat SSL auto-signé...${NC}"

# Configuration OpenSSL pour permettre l'utilisation d'une adresse IP
cat > "$ssl_path/openssl.cnf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $SERVER_IP

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = $SERVER_IP
DNS.1 = localhost
EOF

# Génération du certificat auto-signé
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout "$ssl_path/privkey.pem" \
  -out "$ssl_path/fullchain.pem" \
  -config "$ssl_path/openssl.cnf"

if [ $? -ne 0 ]; then
  echo -e "${RED}Erreur lors de la création du certificat SSL.${NC}"
  exit 1
fi

chmod 600 "$ssl_path/privkey.pem"
chmod 644 "$ssl_path/fullchain.pem"

echo -e "${GREEN}Certificat SSL créé avec succès.${NC}"

# Création de la configuration Nginx avec HTTPS activé
echo -e "${GREEN}Activation de HTTPS dans la configuration Nginx...${NC}"

cat > "$nginx_conf_path/default.conf" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_IP localhost;
    
    # Redirection vers HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $SERVER_IP localhost;
    
    # Certificats SSL
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # Configuration SSL de base
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    
    # En-têtes de sécurité
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy pour FHIRHub
    location / {
        proxy_pass http://fhirhub:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # Proxy pour Grafana
    location /grafana/ {
        proxy_pass http://grafana:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Configuration spécifique à Grafana
        proxy_set_header Authorization "";
        sub_filter_once off;
        sub_filter 'href="/' 'href="/grafana/';
        sub_filter 'src="/' 'src="/grafana/';
    }
    
    # Proxy pour Prometheus
    location /prometheus/ {
        proxy_pass http://prometheus:9090/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Configuration spécifique à Prometheus
        sub_filter_once off;
        sub_filter 'href="/' 'href="/prometheus/';
        sub_filter 'src="/' 'src="/prometheus/';
    }
}
EOF

# Redémarrage de Nginx pour appliquer la configuration
echo -e "${GREEN}Redémarrage de Nginx pour appliquer la configuration HTTPS...${NC}"
docker-compose restart nginx

echo -e "${GREEN}Configuration SSL terminée avec succès!${NC}"
echo -e "Vos services sont maintenant accessibles via HTTPS à l'adresse https://$SERVER_IP"
echo -e "Grafana est disponible à l'adresse https://$SERVER_IP/grafana"
echo -e "Prometheus est disponible à l'adresse https://$SERVER_IP/prometheus"
echo -e "${YELLOW}NOTE: Comme ce certificat est auto-signé, votre navigateur affichera un avertissement de sécurité.${NC}"
echo -e "${YELLOW}Vous pouvez accepter ce risque pour continuer vers le site.${NC}"
EOF

chmod 755 "$BASE_DIR/setup-ssl.sh"
info "Script de configuration SSL créé et rendu exécutable"

# Création du docker-compose.yml
info "Création du fichier docker-compose.yml..."
cat > "$BASE_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  # Nginx comme proxy inverse pour sécuriser l'accès
  nginx:
    image: nginx:latest
    container_name: fhirhub-nginx
    restart: unless-stopped
    ports:
      - "80:80"     # HTTP
      - "443:443"   # HTTPS
    volumes:
      - ./config/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./data/nginx/logs:/var/log/nginx:rw
      - ./data/nginx/ssl:/etc/nginx/ssl:rw
      - ./data/nginx/certbot/conf:/etc/letsencrypt:rw
      - ./data/nginx/certbot/www:/var/www/certbot:rw
    networks:
      - fhirhub-network
    depends_on:
      - fhirhub
      - grafana
      - prometheus
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  # Certbot pour gérer automatiquement les certificats SSL
  certbot:
    image: certbot/certbot:latest
    container_name: fhirhub-certbot
    restart: unless-stopped
    volumes:
      - ./data/nginx/certbot/conf:/etc/letsencrypt:rw
      - ./data/nginx/certbot/www:/var/www/certbot:rw
    depends_on:
      - nginx
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait ${!}; done;'"
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Application principale FHIRHub
  fhirhub:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fhirhub
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"  # Uniquement accessible via Nginx
      - "127.0.0.1:9091:9091"  # Uniquement accessible via Nginx
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_PATH=/app/storage/db/fhirhub.db
      - DB_PERSISTENT=true
      - JWT_SECRET=${JWT_SECRET:-changeme_in_env_file}  # Secret stocké dans un fichier .env
      - METRICS_ENABLED=true
      - METRICS_PORT=9091
      - LOKI_URL=http://loki:3100
    volumes:
      # Volumes avec droits spécifiques et séparation claire
      - ./data/db:/app/storage/db:rw
      - ./data/storage:/app/storage/data:rw
      - ./data/logs:/app/storage/logs:rw
      - ./data/backups:/app/storage/backups:rw
      - ./data/french_terminology:/app/french_terminology:ro  # En lecture seule pour plus de sécurité
      # Support de la structure legacy (en lecture seule)
      - ./data/storage:/app/data:ro
    # Utiliser un utilisateur non-root pour plus de sécurité
    user: "${APP_UID:-1000}:${APP_GID:-1000}"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "10"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    # Limite des ressources pour éviter les abus
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  # Prometheus pour la collecte de métriques
  prometheus:
    image: prom/prometheus:latest
    container_name: fhirhub-prometheus
    restart: unless-stopped
    ports:
      - "127.0.0.1:9092:9090"  # Uniquement accessible via Nginx
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./data/prometheus:/prometheus:rw
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--no-scrape.adjust-timestamps'
    environment:
      - "TZ=Europe/Paris"
    user: "${PROM_UID:-65534}:${PROM_GID:-65534}"  # nobody:nogroup pour plus de sécurité
    depends_on:
      - fhirhub
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # Grafana pour la visualisation des métriques
  grafana:
    image: grafana/grafana:latest
    container_name: fhirhub-grafana
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"  # Uniquement accessible via Nginx
    volumes:
      - ./data/grafana:/var/lib/grafana:rw
      - ./config/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./config/grafana/dashboards:/var/lib/grafana/dashboards:ro
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-changeme_in_env_file}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource,grafana-loki-datasource
      - GF_PATHS_DATA=/var/lib/grafana
      - GF_PATHS_LOGS=/var/lib/grafana/logs
      - GF_PATHS_PLUGINS=/var/lib/grafana/plugins
      - GF_AUTH_ANONYMOUS_ENABLED=false
      - GF_SECURITY_COOKIE_SECURE=true
      - GF_SECURITY_COOKIE_SAMESITE=strict
    user: "${GRAFANA_UID:-472}:${GRAFANA_GID:-472}"  # Grafana default user
    depends_on:
      - prometheus
      - loki
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # Node Exporter pour la collecte de métriques système
  node-exporter:
    image: prom/node-exporter:latest
    container_name: fhirhub-node-exporter
    restart: unless-stopped
    ports:
      - "127.0.0.1:9100:9100"  # Uniquement accessible via Nginx
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.ignored-mount-points=^/(sys|proc|dev|host|etc)($|/)'
    user: "${NODE_EXP_UID:-65534}:${NODE_EXP_GID:-65534}"  # nobody:nogroup
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M
      
  # Loki pour la collecte et l'analyse des logs
  loki:
    image: grafana/loki:2.8.2
    container_name: fhirhub-loki
    restart: unless-stopped
    ports:
      - "127.0.0.1:3100:3100"  # Uniquement accessible via Nginx
    volumes:
      - ./data/loki:/loki:rw
      - ./config/loki/loki-config.yaml:/etc/loki/local-config.yaml:ro
    command: -config.file=/etc/loki/local-config.yaml
    user: "${LOKI_UID:-10001}:${LOKI_GID:-10001}"  # Utilisateur dédié
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
      
  # Promtail pour collecter et envoyer les logs à Loki
  promtail:
    image: grafana/promtail:latest
    container_name: fhirhub-promtail
    restart: unless-stopped
    volumes:
      - ./data/logs:/var/log/fhirhub:ro
      - ./config/promtail/promtail-config.yaml:/etc/promtail/config.yaml:ro
    command: -config.file=/etc/promtail/config.yaml
    depends_on:
      - loki
    user: "${PROMTAIL_UID:-10002}:${PROMTAIL_GID:-10002}"  # Utilisateur dédié
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M
      
  # Watchtower pour les mises à jour automatiques des conteneurs
  watchtower:
    image: containrrr/watchtower:latest
    container_name: fhirhub-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_LABEL_ENABLE=true
      - WATCHTOWER_INCLUDE_STOPPED=false
      - WATCHTOWER_SCHEDULE=0 0 4 * * *  # Exécuté tous les jours à 4h00 du matin
      - WATCHTOWER_TIMEOUT=60s
      - TZ=Europe/Paris
      - WATCHTOWER_NOTIFICATIONS=shoutrrr
      - WATCHTOWER_NOTIFICATION_URL=${WATCHTOWER_NOTIFICATION_URL:-""}
    networks:
      - fhirhub-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M

  # Service de sauvegarde automatique
  backup:
    image: alpine:latest
    container_name: fhirhub-backup
    command: sh -c "while true; do sleep 86400; /scripts/backup.sh; done"
    volumes:
      - ./data:/data:ro  # Accès en lecture seule aux données
      - ./data/backups:/backups:rw  # Stockage des sauvegardes
      - ./scripts:/scripts:ro  # Scripts de sauvegarde
    environment:
      - BACKUP_RETENTION=14  # Nombre de jours de rétention des sauvegardes
      - TZ=Europe/Paris
    user: "${BACKUP_UID:-10003}:${BACKUP_GID:-10003}"  # Utilisateur dédié
    networks:
      - fhirhub-network
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M

# Définition des réseaux avec sécurité renforcée
networks:
  fhirhub-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: fhirhub-br
    ipam:
      config:
        - subnet: 172.20.0.0/24  # Réseau isolé avec plage définie
EOF