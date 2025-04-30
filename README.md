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