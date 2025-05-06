# FHIRHub - Documentation Docker

Ce document explique comment utiliser FHIRHub avec Docker pour faciliter le déploiement et la maintenance.

## Prérequis

- Docker installé sur votre machine
- Docker Compose installé sur votre machine

## Configuration avec volumes persistants

La configuration Docker de FHIRHub utilise des volumes pour conserver vos données entre les redémarrages et les mises à jour du conteneur. Cela garantit que vos informations importantes (base de données, logs, etc.) ne sont pas perdues lors des mises à jour.

### Structure des volumes

Les volumes suivants sont utilisés :

- **db** : Contient la base de données SQLite
- **data** : Contient les données persistantes (conversions, workflows, etc.)
- **logs** : Contient les fichiers journaux
- **backups** : Contient les sauvegardes
- **french_terminology** : Contient les fichiers de terminologie française

## Installation et démarrage

### Méthode simple (recommandée)

1. Lancez le script d'initialisation pour créer la structure de dossiers et le fichier .env :

```bash
./docker-init.sh
```

2. Démarrez l'application avec Docker Compose :

```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. Accédez à l'application à l'adresse : http://localhost:5000

### Méthode manuelle

1. Créez les répertoires pour les volumes :

```bash
mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology
mkdir -p volumes/data/conversions volumes/data/history volumes/data/outputs volumes/data/test
```

2. Créez un fichier .env avec le contenu suivant :

```
PORT=5000
JWT_SECRET=fhirhub-secure-jwt-secret-change-me
DB_DIR=./volumes/db
DATA_DIR=./volumes/data
LOGS_DIR=./volumes/logs
BACKUPS_DIR=./volumes/backups
TERMINOLOGY_DIR=./volumes/french_terminology
```

3. Démarrez l'application avec Docker Compose :

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Gestion du conteneur

### Afficher les logs

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Arrêter le conteneur

```bash
docker-compose -f docker-compose.prod.yml down
```

### Redémarrer le conteneur

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Mettre à jour vers une nouvelle version

1. Récupérez la nouvelle version du code source
2. Reconstruisez et redémarrez le conteneur :

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Sauvegarde des données

Vos données sont stockées dans le répertoire `volumes/` sur votre machine hôte. Pour sauvegarder les données, il suffit de copier ce répertoire.

### Sauvegarde manuelle

```bash
# Arrêtez d'abord le conteneur
docker-compose -f docker-compose.prod.yml down

# Créez une archive de sauvegarde
tar -czf fhirhub_backup_$(date +%Y%m%d).tar.gz volumes/

# Redémarrez le conteneur
docker-compose -f docker-compose.prod.yml up -d
```

## Restauration des données

Pour restaurer les données à partir d'une sauvegarde :

```bash
# Arrêtez d'abord le conteneur
docker-compose -f docker-compose.prod.yml down

# Extrayez l'archive de sauvegarde
tar -xzf fhirhub_backup_YYYYMMDD.tar.gz

# Redémarrez le conteneur
docker-compose -f docker-compose.prod.yml up -d
```

## Dépannage

### Le conteneur ne démarre pas

Vérifiez les logs pour comprendre le problème :

```bash
docker-compose -f docker-compose.prod.yml logs
```

### Problème de permissions

Si vous rencontrez des problèmes de permissions, assurez-vous que les répertoires de volumes ont les bonnes permissions :

```bash
chmod -R 755 volumes/
```

### Port déjà utilisé

Si le port 5000 est déjà utilisé par une autre application, modifiez le fichier .env pour utiliser un autre port.

## Identifiants par défaut

- **Utilisateur** : admin
- **Mot de passe** : adminfhirhub