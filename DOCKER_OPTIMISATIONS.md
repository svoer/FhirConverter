# Optimisation des Fichiers Docker Compose pour FHIRHub

## Modifications Apportées

Nous avons optimisé les fichiers Docker Compose pour FHIRHub afin de rendre l'application plus maintenable et faciliter les mises à jour futures. Ces modifications garantissent une séparation claire entre les données persistantes et les conteneurs applicatifs.

### Principales Optimisations

1. **Utilisation de volumes nommés Docker**
   - Remplacement des montages de dossiers locaux par des volumes Docker nommés
   - Séparation complète des données applicatives des conteneurs
   - Protection contre la perte de données lors des mises à jour

2. **Structure optimisée des données**
   - Volumes séparés pour chaque type de données:
     - `fhirhub_db`: Base de données SQLite
     - `fhirhub_data`: Données applicatives
     - `fhirhub_logs`: Journaux d'application
     - `fhirhub_backups`: Sauvegardes automatiques
     - `fhirhub_terminology`: Terminologies françaises

3. **Facilitation des imports/exports**
   - Ajout de dossiers mappés pour l'import/export de données
   - Simplification des échanges de données avec le conteneur

4. **Suppression des outils de monitoring**
   - Retrait de Prometheus, Grafana et des outils de monitoring
   - Simplification de la configuration

5. **Standardisation des ports**
   - Utilisation du port 5001 pour éviter les conflits
   - Cohérence entre les différentes configurations

6. **Ajout d'un script de migration**
   - Création d'un script `migrate-docker-data.sh` pour faciliter la transition
   - Migration automatique des données de l'ancienne à la nouvelle structure

## Versions Disponibles

### Configuration Complète (docker-compose.yml)
- Configuration standard avec toutes les fonctionnalités
- Utilise des volumes nommés avec préfixe `fhirhub_`

### Configuration Minimale (docker-compose-minimal.yml)
- Version allégée pour une utilisation avec des ressources limitées
- Utilise des volumes nommés avec préfixe `fhirhub_minimal_`

## Utilisation

Pour démarrer l'application avec la nouvelle configuration:

```bash
# Version complète
docker-compose up -d

# Version minimale
docker-compose -f docker-compose-minimal.yml up -d
```

Pour migrer les données de l'ancienne structure vers la nouvelle:

```bash
bash migrate-docker-data.sh
```