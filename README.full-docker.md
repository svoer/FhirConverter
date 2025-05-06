# FHIRHub - Documentation Docker Complète

Ce document explique comment utiliser FHIRHub avec Docker dans une configuration complète incluant Prometheus et Grafana.

## Prérequis

- Docker installé sur votre machine
- Docker Compose installé sur votre machine

## Composants de la configuration complète

Cette configuration Docker inclut plusieurs services:

1. **FHIRHub** - L'application principale de conversion HL7 vers FHIR
2. **Prometheus** - Système de surveillance pour collecter les métriques
3. **Grafana** - Interface de visualisation des métriques avec tableaux de bord
4. **Node Exporter** - Collecteur de métriques système pour la machine hôte

## Structure des volumes

Les volumes suivants sont utilisés pour conserver vos données entre les redémarrages:

- **db** : Contient la base de données SQLite
- **data** : Contient les données persistantes (conversions, workflows, etc.)
- **logs** : Contient les fichiers journaux
- **backups** : Contient les sauvegardes
- **french_terminology** : Contient les fichiers de terminologie française
- **prometheus** : Contient les données historiques de Prometheus
- **grafana** : Contient la configuration et les données de Grafana

## Installation et démarrage

### Initialisation (recommandée)

1. Lancez le script d'initialisation pour créer la structure complète:

```bash
./docker-init-full.sh
```

Ce script va:
- Créer tous les répertoires nécessaires
- Configurer Prometheus avec le fichier de configuration approprié
- Configurer Grafana avec une source de données Prometheus
- Ajouter un tableau de bord initial pour FHIRHub

2. Démarrez tous les services:

```bash
docker-compose -f docker-compose.full.yml up -d
```

3. Accédez aux interfaces:
   - FHIRHub: http://localhost:5000
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000

### Installation manuelle (alternative)

Si vous préférez configurer manuellement:

1. Créez les répertoires pour les volumes:

```bash
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana
mkdir -p volumes/data/conversions volumes/data/history volumes/data/outputs volumes/data/test volumes/data/workflows
chmod -R 755 volumes
```

2. Créez les répertoires pour la configuration:

```bash
mkdir -p prometheus
mkdir -p grafana/provisioning/datasources
mkdir -p grafana/dashboards
```

3. Créez un fichier de configuration Prometheus (`prometheus/prometheus.yml`):

```yaml
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
```

4. Créez un fichier de configuration pour la source de données Grafana (`grafana/provisioning/datasources/prometheus.yml`):

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

5. Démarrez tous les services:

```bash
docker-compose -f docker-compose.full.yml up -d
```

## Gestion des conteneurs

### Afficher les logs

```bash
# Tous les services
docker-compose -f docker-compose.full.yml logs -f

# Un service spécifique
docker-compose -f docker-compose.full.yml logs -f fhirhub
```

### Arrêter tous les services

```bash
docker-compose -f docker-compose.full.yml down
```

### Redémarrer un service spécifique

```bash
docker-compose -f docker-compose.full.yml restart fhirhub
```

### Mettre à jour vers une nouvelle version

1. Récupérez la nouvelle version du code source
2. Reconstruisez et redémarrez les services:

```bash
docker-compose -f docker-compose.full.yml up -d --build
```

## Sauvegarde des données

Vos données sont stockées dans le répertoire `volumes/`. Pour sauvegarder les données:

```bash
# Arrêtez d'abord les conteneurs
docker-compose -f docker-compose.full.yml down

# Créez une archive de sauvegarde
tar -czf fhirhub_backup_$(date +%Y%m%d).tar.gz volumes/

# Redémarrez les conteneurs
docker-compose -f docker-compose.full.yml up -d
```

## Restauration des données

Pour restaurer à partir d'une sauvegarde:

```bash
# Arrêtez d'abord les conteneurs
docker-compose -f docker-compose.full.yml down

# Extrayez l'archive de sauvegarde
tar -xzf fhirhub_backup_YYYYMMDD.tar.gz

# Redémarrez les conteneurs
docker-compose -f docker-compose.full.yml up -d
```

## Surveillance et métriques

### Prometheus (http://localhost:9090)

Prometheus collecte les métriques de:
- FHIRHub (métriques d'application)
- Node Exporter (métriques système)
- Prometheus lui-même

Vous pouvez explorer les métriques en utilisant l'interface de requête de Prometheus.

### Grafana (http://localhost:3000)

Grafana est pré-configuré avec:
- Source de données Prometheus
- Un tableau de bord initial "FHIRHub Overview"

#### Identifiants Grafana par défaut:
- Utilisateur: admin
- Mot de passe: fhirhub-admin

Vous pouvez créer d'autres tableaux de bord ou importer des modèles existants.

## Dépannage

### Le conteneur FHIRHub ne démarre pas

Vérifiez les logs:

```bash
docker-compose -f docker-compose.full.yml logs fhirhub
```

### Problème de permissions

Si vous rencontrez des problèmes de permissions, assurez-vous que les répertoires ont les bonnes permissions:

```bash
chmod -R 755 volumes/
```

### Problème de connexion à Prometheus depuis Grafana

Vérifiez que le service Prometheus est en cours d'exécution:

```bash
docker-compose -f docker-compose.full.yml ps prometheus
```

Et vérifiez les logs:

```bash
docker-compose -f docker-compose.full.yml logs prometheus
```

### Port déjà utilisé

Si l'un des ports (5000, 9090, 9091, 3000, 9100) est déjà utilisé, modifiez le port correspondant dans le fichier `docker-compose.full.yml`.

## Identifiants par défaut

### FHIRHub
- **Utilisateur**: admin
- **Mot de passe**: adminfhirhub

### Grafana
- **Utilisateur**: admin
- **Mot de passe**: fhirhub-admin