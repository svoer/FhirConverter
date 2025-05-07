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

# Création de la configuration Nginx
echo -e "${GREEN}Création de la configuration Nginx...${NC}"

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

# Création d'une configuration Nginx de base
if [ ! -f "./config/nginx/nginx.conf" ]; then
  echo -e "${GREEN}Création d'une configuration Nginx de base...${NC}"
  mkdir -p "./config/nginx"
  
  cat > "./config/nginx/nginx.conf" << EOF
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
fi

# Affichage des instructions finales
echo -e "${GREEN}Configuration SSL terminée avec succès!${NC}"
echo -e "Vos services sont maintenant accessibles via HTTPS à l'adresse https://$SERVER_IP"
echo -e "Grafana est disponible à l'adresse https://$SERVER_IP/grafana"
echo -e "Prometheus est disponible à l'adresse https://$SERVER_IP/prometheus"
echo -e "${YELLOW}NOTE: Comme ce certificat est auto-signé, votre navigateur affichera un avertissement de sécurité.${NC}"
echo -e "${YELLOW}Vous pouvez accepter ce risque pour continuer vers le site.${NC}"
