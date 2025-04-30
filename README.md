# 🔥 FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

## Le futur du partage de données santé, dès aujourd'hui.

FHIRHub est une solution complète pour convertir vos messages HL7 v2.5 en ressources FHIR R4, compatible avec les spécifications françaises de l'ANS (Agence du Numérique en Santé).

Modernisez votre interopérabilité, sans refonte, sans complexité. FHIRHub – L'upgrade FHIR, aussi simple qu'un glisser-déposer.

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Licence](https://img.shields.io/badge/licence-Propriétaire-red.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-green.svg)

## Prérequis

- Node.js 18.0.0 ou supérieur
- NPM 8.0.0 ou supérieur
- Git (pour le clonage du dépôt)
- Pour l'utilisation des scripts Python (en option) : Python 3.6 ou supérieur

## Caractéristiques

- Conversion complète de messages HL7 v2.5 vers FHIR R4
- Support des terminologies françaises (compatible ANS)
- Interface utilisateur intuitive pour la conversion directe
- API REST sécurisée avec authentification par clé API
- Gestion des applications et des utilisateurs
- Journalisation et suivi des conversions
- Documentation Swagger intégrée
- Environnement entièrement portable avec SQLite
- Système de cache intelligent pour optimiser les performances
- Scripts d'installation et de démarrage pour Windows, Linux et macOS
- Déploiement facilité via Docker

## Installation

FHIRHub peut être installé et déployé facilement sur Windows, Linux et macOS. Le projet inclut des scripts d'installation et de démarrage pour chaque plateforme.

### Windows

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Lancer le script d'installation
install.bat

# Démarrer l'application
start.bat
```

### Linux

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Donner les permissions d'exécution aux scripts
chmod +x install.sh start.sh

# Lancer le script d'installation
./install.sh

# Démarrer l'application
./start.sh
```

### macOS

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Donner les permissions d'exécution aux scripts
chmod +x install.sh start.sh

# Lancer le script d'installation
./install.sh

# Démarrer l'application
./start.sh
```

Les scripts d'installation vérifient la présence de Node.js, créent les répertoires nécessaires, installent les dépendances et initialisent la base de données SQLite avec les données par défaut. Les scripts de démarrage configurent l'environnement et lancent l'application.

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

## Utilisation

Accédez à l'application via `http://localhost:5000` et connectez-vous avec les identifiants par défaut:

- Identifiant: admin
- Mot de passe: adminfhirhub

## Structure du Projet

```
fhirhub/
├── api/                    # Modules API
├── data/                   # Stockage SQLite et logs
├── french_terminology/     # Mappings pour terminologies françaises
├── middleware/             # Middleware Express
├── public/                 # Interface utilisateur
├── routes/                 # Routes Express
├── src/                    # Code source principal
├── utils/                  # Utilitaires et fonctions d'aide
├── app.js                  # Point d'entrée principal
├── hl7Parser.js            # Parseur HL7 optimisé
├── hl7ToFhirAdvancedConverter.js  # Convertisseur HL7 vers FHIR
└── server.js               # Configuration du serveur
```

## Développement

Pour le développement, vous pouvez utiliser les commandes suivantes:

```bash
# Lancer en mode développement avec hot-reload
npm run dev

# Exécuter les tests
npm test
```

## Déploiement avec Docker

FHIRHub peut être facilement déployé avec Docker, ce qui simplifie l'installation et la maintenance sur n'importe quel environnement (Windows, Linux ou macOS).

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

1. Assurez-vous que Docker et Docker Compose sont installés sur votre système.
2. Clonez le dépôt et naviguez dans le répertoire du projet.
3. Construisez l'image Docker :

```bash
docker-compose build
```

4. Démarrez les conteneurs en mode détaché :

```bash
docker-compose up -d
```

5. Pour le déploiement en production, utilisez le fichier de configuration dédié :

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Persistance des données

Les données sont stockées dans des volumes Docker pour assurer leur persistance entre les redémarrages :

- `fhirhub_data` : Contient la base de données SQLite et les fichiers de données
- `fhirhub_logs` : Contient les journaux de l'application

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