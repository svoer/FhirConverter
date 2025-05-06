# FHIRHub - Documentation Docker

Ce document explique comment utiliser FHIRHub avec Docker.

## Configuration incluse

Cette configuration Docker complète inclut :

1. **FHIRHub** - L'application principale de conversion HL7 vers FHIR
2. **Prometheus** - Système de surveillance pour collecter les métriques
3. **Grafana** - Interface de visualisation des métriques avec tableaux de bord
4. **Node Exporter** - Collecteur de métriques système pour la machine hôte

## Prérequis

- Docker installé sur votre machine
- Docker Compose installé sur votre machine

## Structure des volumes

Les volumes suivants sont utilisés pour conserver vos données entre les redémarrages:

- **volumes/db** : Contient la base de données SQLite
- **volumes/data** : Contient les données persistantes (conversions, workflows, etc.)
- **volumes/logs** : Contient les fichiers journaux
- **volumes/backups** : Contient les sauvegardes
- **volumes/french_terminology** : Contient les fichiers de terminologie française
- **volumes/prometheus** : Contient les données historiques de Prometheus
- **volumes/grafana** : Contient la configuration et les données de Grafana

## Installation et démarrage

### Installation avec le script d'initialisation (recommandée)

1. Lancez le script d'initialisation pour créer la structure complète:

```bash
./docker-init.sh
```

2. Démarrez tous les services:

```bash
docker-compose up -d
```

3. Accédez aux interfaces:
   - FHIRHub: http://localhost:5000
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3000

## Gestion des conteneurs

### Afficher les logs

```bash
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f fhirhub
```

### Arrêter tous les services

```bash
docker-compose down
```

### Redémarrer un service spécifique

```bash
docker-compose restart fhirhub
```

### Mettre à jour vers une nouvelle version

1. Récupérez la nouvelle version du code source
2. Reconstruisez et redémarrez les services:

```bash
docker-compose up -d --build
```

## Sauvegarde des données

Vos données sont stockées dans le répertoire `volumes/`. Pour sauvegarder les données:

```bash
# Arrêtez d'abord les conteneurs
docker-compose down

# Créez une archive de sauvegarde
tar -czf fhirhub_backup_$(date +%Y%m%d).tar.gz volumes/

# Redémarrez les conteneurs
docker-compose up -d
```

## Restauration des données

Pour restaurer à partir d'une sauvegarde:

```bash
# Arrêtez d'abord les conteneurs
docker-compose down

# Extrayez l'archive de sauvegarde
tar -xzf fhirhub_backup_YYYYMMDD.tar.gz

# Redémarrez les conteneurs
docker-compose up -d
```

## Identifiants par défaut

### FHIRHub
- **Utilisateur**: admin
- **Mot de passe**: adminfhirhub

### Grafana
- **Utilisateur**: admin
- **Mot de passe**: fhirhub-admin