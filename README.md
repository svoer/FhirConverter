# 🔥 FHIRHub

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-18.x%20%7C%2020.x-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

**Convertisseur HL7 v2.5 vers FHIR R4 pour l'écosystème e-santé français**

<div align="center">
  <img src="generated-icon.png" alt="FHIRHub Logo" width="120"/>
  <br>
  <em>Le futur du partage de données santé, dès aujourd'hui</em>
</div>

## ✨ Principales fonctionnalités

| 🚀 Conversion | 🔒 Sécurité | 📊 Monitoring | 🔄 Intégration |
|-------------|----------|-----------|------------|
| Conversion complète HL7 v2.5 → FHIR R4 | Authentification JWT & API Keys | Tableaux de bord Grafana | API REST complète |
| Support terminologies ANS | RBAC (contrôle d'accès) | Métriques Prometheus | Export/import JSON |
| Mappage personnalisable | Journalisation avancée | Filtrage logs par date/erreur | Architecture modulaire |
| Mode online & offline | Audit trail complet | Alertes personnalisables | Docker multi-services |

## 🚀 Démarrage rapide

### Installation locale

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Linux/macOS: Donner les permissions d'exécution et installer
chmod +x install.sh start.sh
./install.sh

# Windows: Lancer le script d'installation
install.bat

# Démarrer l'application
./start.sh   # Linux/macOS
start.bat    # Windows
```

### Déploiement Docker

```bash
# Configuration minimale avec monitoring (recommandée)
./start-minimal.sh

# OU configuration complète avec tous les services
./docker-init.sh
docker-compose up -d
```

Les scripts d'installation effectuent les opérations suivantes automatiquement :

1. **Installation de Node.js intégré** 🆕 :
   - Téléchargement et installation locale de Node.js v20.15.1 si nécessaire
   - Possibilité de choisir entre le Node.js système (si déjà installé et compatible) ou la version intégrée
   - Configuration du chemin d'accès pour une utilisation cohérente à travers tous les scripts
   
2. **Préparation de l'environnement** :
   - Création des répertoires nécessaires pour les données, logs et backups
   - Initialisation des fichiers de configuration (.env)
   - Installation des dépendances NPM requises
   
3. **Configuration des terminologies françaises** :
   - Initialisation des mappings de terminologies françaises de l'ANS
   - Préparation des systèmes d'identifiants et codes standards français
   
4. **Initialisation de la base de données** :
   - Création et configuration de la base de données SQLite
   - Génération des identifiants administrateur par défaut
   - Création des clés API de développement

Les scripts de démarrage détectent la configuration de Node.js utilisée lors de l'installation et utilisent automatiquement la même version pour assurer la cohérence et la compatibilité.

### Installation manuelle

Si vous préférez une installation manuelle :

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Installer les dépendances
npm install

# Créer les dossiers nécessaires
mkdir -p data/conversions data/history data/outputs data/test logs backups

# Démarrer l'application
node app.js
```

## 🧩 Architecture

```
FHIRHub
 ┣ 📂 API RESTful
 ┃  ┣ 🔒 Authentification
 ┃  ┣ 📄 Conversion
 ┃  ┗ 📊 Statistiques
 ┣ 📂 Convertisseurs
 ┃  ┣ 🔄 HL7 Parser
 ┃  ┗ 🔄 FHIR Generator
 ┣ 📂 Interface utilisateur
 ┃  ┣ 📱 Conversion directe
 ┃  ┣ 📊 Tableaux de bord
 ┃  ┗ ⚙️ Administration
 ┗ 📂 Monitoring
    ┣ 📈 Prometheus
    ┣ 📊 Grafana
    ┗ 📋 Loki/Promtail
```

## 📚 Documentation

Pour une documentation complète, consultez le dossier `/docs` ou les pages suivantes:

- [Guide de démarrage rapide](docs/quickstart.md)
- [Configuration avancée](docs/advanced-configuration.md)
- [API Reference](http://localhost:5001/api-docs)
- [FAQ](docs/faq.md)

## Déploiement avec Docker

FHIRHub peut être facilement déployé avec Docker, ce qui simplifie l'installation et la maintenance sur n'importe quel environnement (Windows, Linux ou macOS).

### Installation de Docker

Si Docker n'est pas encore installé sur votre système :

#### Linux (Ubuntu/Debian)
```bash
# Mettre à jour les paquets
sudo apt update

# Installer les prérequis
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Ajouter la clé GPG de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Ajouter le dépôt Docker
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Mettre à jour les paquets et installer Docker
sudo apt update
sudo apt install -y docker-ce docker-compose

# Ajouter votre utilisateur au groupe docker pour éviter d'utiliser sudo
sudo usermod -aG docker ${USER}

# Appliquer les changements de groupe (ou déconnectez-vous puis reconnectez-vous)
newgrp docker
```

#### macOS
1. Téléchargez et installez [Docker Desktop pour Mac](https://www.docker.com/products/docker-desktop)
2. Lancez Docker Desktop depuis vos Applications

#### Windows
1. Téléchargez et installez [Docker Desktop pour Windows](https://www.docker.com/products/docker-desktop)
2. Lancez Docker Desktop et suivez les instructions d'installation
3. Assurez-vous que WSL 2 (Windows Subsystem for Linux) est activé si demandé

### Déploiement rapide

```bash
# Initialisation rapide (Linux/macOS)
./docker-init.sh
docker-compose -f docker-compose.prod.yml up -d

# Ou sur Windows
docker-init.bat
docker-compose -f docker-compose.prod.yml up -d
```

### Déploiement détaillé

1. Clonez le dépôt et naviguez dans le répertoire du projet :
   ```bash
   git clone https://github.com/votre-organisation/fhirhub.git
   cd fhirhub
   ```

2. Exécutez le script d'initialisation pour préparer l'environnement :
   ```bash
   # Sous Linux/macOS
   chmod +x docker-init.sh
   ./docker-init.sh
   
   # Sous Windows
   docker-init.bat
   ```
   Ce script va :
   - Vérifier les prérequis Docker
   - Créer les dossiers nécessaires pour les volumes
   - Générer les fichiers de configuration
   - Préparer les fichiers de terminologie française

3. Construisez l'image Docker :
   ```bash
   docker-compose build
   ```

4. Démarrez les conteneurs en mode détaché :
   ```bash
   docker-compose up -d
   ```
   Cela va démarrer :
   - Le serveur FHIRHub principal
   - Le service Prometheus pour les métriques
   - Le service Grafana pour les tableaux de bord
   - Le service Node Exporter pour les métriques système

5. Pour le déploiement en production, utilisez le fichier de configuration dédié :
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Persistance des données

Les données sont stockées dans des volumes Docker pour assurer leur persistance entre les redémarrages :

- `fhirhub_data` : Contient la base de données SQLite et les fichiers de données
- `fhirhub_logs` : Contient les journaux de l'application
- `fhirhub_grafana` : Contient les configurations et données de Grafana
- `fhirhub_prometheus` : Contient les métriques de Prometheus
- `fhirhub_loki` : Contient les logs structurés pour analyse avancée

### Mises à jour automatiques avec Watchtower 🆕

FHIRHub intègre désormais Watchtower, un service qui surveille et met à jour automatiquement les conteneurs Docker :

```bash
# Démarrer tous les services, y compris Watchtower
docker-compose up -d
```

#### Configuration de Watchtower

Watchtower est configuré pour :
- Vérifier les mises à jour toutes les nuits à 4h00 du matin
- Mettre à jour uniquement les conteneurs marqués avec l'étiquette `com.centurylinklabs.watchtower.enable=true`
- Nettoyer les anciennes images après les mises à jour
- Respecter une temporisation de 60 secondes

#### Personnalisation des mises à jour

Pour modifier la planification des mises à jour, vous pouvez éditer la variable d'environnement `WATCHTOWER_SCHEDULE` dans le fichier docker-compose.yml :

```yaml
watchtower:
  environment:
    - WATCHTOWER_SCHEDULE=0 0 4 * * *  # Format cron : exécuter à 4h00 tous les jours
```

## 🌐 Accès aux interfaces

| Service | URL | Identifiants par défaut |
|---------|-----|------------------------|
| **FHIRHub** | http://localhost:5001 | admin / adminfhirhub |
| **Grafana** | http://localhost:3000 | admin / admin123 |
| **Prometheus** | http://localhost:9090 | - |
| **API Documentation** | http://localhost:5001/api-docs | - |

## 📦 Modes de déploiement

### ⚙️ Configuration minimale

Idéale pour les déploiements légers ou les environnements de développement:

```bash
./start-minimal.sh
```

Cette configuration inclut:
- Application FHIRHub principale
- Prometheus pour les métriques
- Grafana pour la visualisation
- Base de données SQLite
- Terminologies françaises

### 🏢 Configuration complète

Pour les environnements de production nécessitant des fonctionnalités avancées:

```bash
docker-compose up -d
```

Cette configuration ajoute:
- Loki pour la gestion avancée des logs
- Promtail pour la collecte des logs
- Node Exporter pour les métriques système
- Watchtower pour les mises à jour automatiques

## 🧰 Outils de maintenance

| Script | Description |
|--------|-------------|
| `clean-docker.sh` | Nettoie complètement l'environnement Docker |
| `fix-docker-loki-permissions.sh` | Résout les problèmes de permissions |
| `docker-restart-grafana.sh` | Redémarre les services de monitoring |
| `backup-docker-data.sh` | Sauvegarde les données importantes |

### Monitoring avec Grafana et Prometheus 🆕

FHIRHub intègre un système complet de monitoring avec Prometheus et Grafana, offrant une visualisation avancée des logs et des performances.

#### Accéder aux tableaux de bord Grafana

1. Accédez à Grafana via `http://localhost:3000` (ou le port configuré)
2. Connectez-vous avec les identifiants par défaut:
   - Identifiant: admin
   - Mot de passe: admin123
3. Naviguez vers les tableaux de bord disponibles:
   - "Logs de Conversion FHIRHub" - Vue générale des métriques
   - "Logs FHIRHub (Détaillé)" - Dashboard détaillé des logs avec filtrage

#### Fonctionnalités de monitoring

- **Filtrage des logs par date et heure** - Visualisation des logs sur différentes périodes
- **Filtrage par erreurs** - Isolement rapide des conversions en échec
- **Statistiques en temps réel** - Nombre de conversions, temps de traitement, taux d'erreurs
- **Métriques système** - Utilisation CPU, mémoire, connexions actives
- **Tableaux de logs détaillés** - Affichage complet des informations de conversion

#### Scripts de maintenance pour le monitoring

FHIRHub inclut plusieurs scripts pour faciliter la maintenance du système de monitoring :

##### Script de redémarrage des services Grafana et Prometheus

```bash
# Donner les permissions d'exécution
chmod +x restart-grafana-logs.sh

# Exécuter le script
./restart-grafana-logs.sh
```

Ce script redémarre les services nécessaires et vous guide sur les étapes à suivre si les logs n'apparaissent toujours pas correctement.

##### Script de redémarrage des conteneurs Docker

```bash
# Donner les permissions d'exécution
chmod +x docker-restart-grafana.sh

# Exécuter le script
./docker-restart-grafana.sh
```

Ce script est spécifiquement conçu pour l'environnement Docker et va :
- Redémarrer les conteneurs FHIRHub, Prometheus et Grafana
- Vérifier que les services redémarrent correctement
- Afficher des instructions pour accéder aux tableaux de bord
- Proposer des solutions en cas de problème

##### Script de redémarrage des services de logs (Loki et Promtail)

```bash
# Donner les permissions d'exécution
chmod +x docker-restart-loki.sh

# Exécuter le script
./docker-restart-loki.sh
```

Ce script est dédié à la gestion des services de logs et va :
- Redémarrer les conteneurs Loki et Promtail
- Configurer correctement les permissions des volumes
- Vérifier la connectivité entre les services
- Proposer des solutions de dépannage pour les problèmes courants

##### Correction des permissions pour Loki 

Si vous rencontrez des problèmes d'accès aux logs dans Grafana via Loki :

```bash
# Donner les permissions d'exécution
chmod +x fix-docker-loki-permissions.sh

# Exécuter le script
./fix-docker-loki-permissions.sh
```

Ce script corrige les problèmes de permissions courants pour Loki et Promtail.

##### Réinitialisation des métriques Prometheus

Si vous souhaitez réinitialiser les compteurs Prometheus sans affecter les données de la base de données :

```bash
# Donner les permissions d'exécution
chmod +x reset-prometheus-metrics.sh

# Exécuter le script
./reset-prometheus-metrics.sh
```

Ce script va nettoyer les métriques Prometheus tout en préservant les données de conversion.

Pour effectuer une sauvegarde des données :

```bash
# Créer un répertoire de sauvegarde
mkdir -p backups

# Exporter les données du volume
docker run --rm -v fhirhub_data:/data -v $(pwd)/backups:/backup \
  alpine tar -zcf /backup/fhirhub-data-$(date +%Y%m%d).tar.gz /data
```

Pour plus d'informations sur le déploiement Docker, consultez [la documentation Docker](docs/docker_deployment.md).

## Déploiement en production

Pour déployer FHIRHub en production, plusieurs options sont disponibles selon votre environnement.

### Installation comme service système

FHIRHub inclut des scripts qui simplifient l'installation en tant que service système, permettant le démarrage automatique au boot.

#### Linux (systemd)

Utilisez le script d'installation de service fourni :

```bash
# Donnez les permissions d'exécution
chmod +x install-service.sh

# Exécutez le script avec sudo
sudo ./install-service.sh
```

Le script va :
1. Créer un fichier service systemd dans `/etc/systemd/system/fhirhub.service`
2. Configurer le service pour démarrer automatiquement au boot
3. Configurer les logs via journald
4. Démarrer le service si vous le souhaitez

Commandes utiles après l'installation :
```bash
# Vérifier l'état du service
sudo systemctl status fhirhub.service

# Afficher les logs en temps réel
sudo journalctl -u fhirhub.service -f

# Redémarrer le service
sudo systemctl restart fhirhub.service

# Arrêter le service
sudo systemctl stop fhirhub.service
```

#### Windows (service Windows)

Utilisez le script d'installation de service fourni :

```bat
# Exécutez en tant qu'administrateur
install-service.bat
```

Le script va :
1. Télécharger NSSM si nécessaire (Non-Sucking Service Manager)
2. Configurer FHIRHub comme service Windows
3. Configurer le démarrage automatique au boot
4. Configurer les logs dans le dossier `logs`
5. Démarrer le service si vous le souhaitez

Après l'installation, vous pouvez gérer le service via le Gestionnaire de services Windows ou utiliser les commandes suivantes :

```bat
# Utilisez les commandes suivantes ou le Gestionnaire de services Windows
sc query FHIRHub    # Vérifier l'état
sc start FHIRHub    # Démarrer
sc stop FHIRHub     # Arrêter
```

### Installation manuelle du service

Si vous préférez configurer le service manuellement :

#### Linux (systemd)

1. Créez un fichier de service systemd :

```bash
sudo nano /etc/systemd/system/fhirhub.service
```

2. Ajoutez la configuration suivante (adaptez les chemins selon votre installation) :

```ini
[Unit]
Description=FHIRHub - Convertisseur HL7 vers FHIR
After=network.target

[Service]
Type=simple
User=votre_utilisateur
WorkingDirectory=/chemin/vers/fhirhub
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fhirhub
Environment=NODE_ENV=production PORT=5000

[Install]
WantedBy=multi-user.target
```

3. Activez et démarrez le service :

```bash
sudo systemctl enable fhirhub.service
sudo systemctl start fhirhub.service
```

#### Windows (NSSM)

Pour Windows, utilisez NSSM (Non-Sucking Service Manager) :

1. Téléchargez NSSM depuis [https://nssm.cc/download](https://nssm.cc/download)
2. Extrayez l'archive et placez nssm.exe dans un dossier accessible
3. Ouvrez un terminal en tant qu'administrateur et exécutez :

```bat
nssm install FHIRHub
```

4. Dans l'interface qui s'ouvre, configurez le service :
   - Path : chemin vers node.exe (ex: C:\Program Files\nodejs\node.exe)
   - Startup directory : chemin vers votre dossier FHIRHub
   - Arguments : app.js
   - Dans l'onglet Details, renseignez une description
   - Dans l'onglet Environment, ajoutez NODE_ENV=production;PORT=5000

5. Cliquez sur "Install service" puis démarrez-le avec `nssm start FHIRHub`

### Configuration d'un proxy inverse (recommandé)

En production, il est recommandé d'utiliser un proxy inverse (comme Nginx ou Apache) devant FHIRHub :

#### Exemple avec Nginx

```nginx
server {
    listen 80;
    server_name fhirhub.votre-domaine.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Exemple avec Apache

```apache
<VirtualHost *:80>
    ServerName fhirhub.votre-domaine.com
    
    ProxyRequests Off
    ProxyPreserveHost On
    ProxyVia Full
    
    <Proxy *>
        Require all granted
    </Proxy>
    
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/
</VirtualHost>
```

### Configuration HTTPS

Pour sécuriser votre installation en production, configurez HTTPS avec Let's Encrypt :

#### Avec Nginx et Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fhirhub.votre-domaine.com
```

### Création d'une release

FHIRHub inclut des scripts pour préparer facilement une release de production. Ces scripts automatisent la création d'une archive prête à être déployée, l'incrémentation de version, et la création d'un tag Git.

#### Linux/macOS

```bash
# Donnez les permissions d'exécution au script
chmod +x prepare-release.sh

# Exécutez le script
./prepare-release.sh
```

#### Windows

```bat
# Exécutez le script
prepare-release.bat
```

Le script effectue les opérations suivantes :
1. Met à jour la version dans package.json
2. Nettoie les fichiers temporaires
3. Installe uniquement les dépendances de production
4. Copie tous les fichiers nécessaires dans un dossier de release
5. Crée un fichier .env de production avec un secret JWT aléatoire
6. Génère ou met à jour le CHANGELOG.md
7. Crée une archive ZIP contenant la release
8. Crée un commit et un tag Git pour la nouvelle version

L'archive ZIP produite est prête à être déployée sur un serveur de production.

### Mise à jour de version

Pour mettre à jour FHIRHub vers une nouvelle version :

```bash
# Arrêtez le service
sudo systemctl stop fhirhub.service  # Linux
nssm stop FHIRHub  # Windows

# Sauvegardez les données
cp -r ./data ./data_backup_$(date +%Y%m%d)

# Mettez à jour le code
git pull

# Installez les dépendances
npm install

# Redémarrez le service
sudo systemctl start fhirhub.service  # Linux
nssm start FHIRHub  # Windows
```

## Mise à jour des terminologies ANS

Les fichiers de terminologie française se trouvent dans le dossier `french_terminology/`. Voici les principaux fichiers que vous pouvez mettre à jour:

### Fichiers de terminologie:

- `french_terminology/ans_common_codes.json` - Codes communs de l'ANS (mouvements, professions, etc.)
- `french_terminology/ans_oids.json` - Liste des OIDs français pour les identifiants
- `french_terminology/ans_terminology_systems.json` - Systèmes de terminologie français
- `french_terminology/fhir_r4_french_systems.json` - Systèmes FHIR R4 français

### Outils de mise à jour:

- `get_french_terminology.py` - Script pour récupérer les dernières terminologies depuis l'API de l'ANS
- `extract_french_systems.py` - Script pour extraire et organiser les systèmes français

Pour mettre à jour les terminologies, exécutez:

```bash
# Récupérer les dernières terminologies
python get_french_terminology.py

# Extraire et organiser les systèmes pertinents
python extract_french_systems.py
```

Pour plus d'informations sur les scripts de terminologie, consultez [la documentation des scripts](docs/french_terminology_scripts.md).

## Licence

Ce projet est distribué sous licence propriétaire. Tous droits réservés.
Aucune utilisation, modification ou distribution n'est autorisée sans l'accord écrit préalable du propriétaire.

## Support

Pour toute question ou assistance, contactez notre équipe de support à [support@fhirhub.example.com](mailto:support@fhirhub.example.com).