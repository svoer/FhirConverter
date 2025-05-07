# Guide d'utilisation de Loki et Promtail

Ce document présente en détail la configuration et l'utilisation de Loki et Promtail pour la collecte et l'analyse de logs dans FHIRHub.

## Présentation

- **Loki** est un système de stockage et d'agrégation de logs inspiré de Prometheus. Il est conçu pour être très efficace en termes de stockage et offre des fonctionnalités avancées de requêtage.
- **Promtail** est un agent qui collecte les logs et les envoie à Loki. Il peut transformer et étiqueter les logs avant de les envoyer.

## Architecture

Dans FHIRHub, l'architecture de collecte de logs est la suivante :

1. **FHIRHub** génère des logs dans le dossier `./volumes/logs`
2. **Promtail** surveille ces fichiers de logs et les envoie à Loki
3. **Loki** stocke les logs et permet de les interroger
4. **Grafana** se connecte à Loki pour visualiser et analyser les logs

## Configuration de Loki

La configuration de Loki se trouve dans le fichier `loki/loki-config.yaml`. Voici les principales sections :

```yaml
auth_enabled: false  # Désactive l'authentification pour cet environnement

server:
  http_listen_port: 3100  # Port d'écoute de Loki

ingester:
  # Configuration des ingéreurs de logs
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
    dir: /loki/wal  # Répertoire pour le WAL (Write-Ahead Log)

schema_config:
  # Définit comment les données sont stockées
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  # Configuration du stockage
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    cache_ttl: 24h
  filesystem:
    directory: /loki/chunks

compactor:
  # Configuration du compacteur (optimise le stockage)
  working_directory: /loki/compactor

limits_config:
  # Limites pour éviter les surcharges
  reject_old_samples: true
  reject_old_samples_max_age: 168h  # 7 jours
  split_queries_by_interval: 15m
  max_query_parallelism: 32
  max_look_back_period: 0  # Désactivé, pas de limite de look-back

table_manager:
  # Gestion de la rétention
  retention_deletes_enabled: false
  retention_period: 0s

query_range:
  # Configuration du cache pour les requêtes
  align_queries_with_step: true
  max_retries: 5
  cache_results: true
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100
```

### Volumes Docker pour Loki

Dans le `docker-compose.yml`, Loki est configuré pour utiliser les volumes suivants :

```yaml
volumes:
  - ./loki/chunks:/loki/chunks:rw
  - ./loki/index:/loki/index:rw
  - ./loki/cache:/loki/cache:rw
  - ./loki/wal:/loki/wal:rw
  - ./loki/compactor:/loki/compactor:rw
  - ./loki/loki-config.yaml:/etc/loki/local-config.yaml:ro
```

Ces volumes permettent de stocker les données de manière persistante entre les redémarrages.

## Configuration de Promtail

La configuration de Promtail se trouve dans le fichier `promtail/promtail-config.yaml`. Voici les principales sections :

```yaml
server:
  http_listen_port: 9080  # Port d'écoute de Promtail

positions:
  filename: /tmp/positions.yaml  # Fichier qui stocke les positions de lecture dans les logs

clients:
  - url: http://loki:3100/loki/api/v1/push  # URL de Loki pour envoyer les logs

scrape_configs:
  - job_name: fhirhub-logs  # Configuration pour les logs généraux
    static_configs:
      - targets:
          - localhost
        labels:
          job: fhirhub-logs
          __path__: /var/log/fhirhub/*.log
    
    pipeline_stages:  # Transformation des logs avant envoi
      - json:  # Parse les logs JSON
          expressions:
            timestamp: timestamp
            level: level
            message: message
            service: service
            application: application
      - timestamp:  # Extrait le timestamp
          source: timestamp
          format: RFC3339
      - labels:  # Ajoute des labels pour le filtrage
          level:
          service:
          application:
      - output:  # Format de sortie
          source: message

  - job_name: fhirhub-conversion-logs  # Configuration pour les logs de conversion
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
```

Dans cette configuration :
- Promtail surveille deux types de logs : les logs généraux et les logs de conversion
- Les logs sont parses en JSON pour extraire les champs pertinents
- Des labels sont ajoutés pour faciliter le filtrage dans Grafana
- Les timestamps sont correctement formatés pour l'affichage chronologique

## Résolution des problèmes courants

### Problèmes de permissions

Si Loki ne démarre pas correctement, il s'agit souvent d'un problème de permissions sur les volumes. Utilisez le script `fix-docker-loki-permissions.sh` :

```bash
chmod +x fix-docker-loki-permissions.sh
./fix-docker-loki-permissions.sh
```

### Problèmes de configuration

Si la configuration de Loki contient des erreurs, vous verrez des messages d'erreur dans les logs. Utilisez cette commande pour voir les logs :

```bash
docker logs fhirhub-loki
```

Les erreurs communes incluent :
- Champs de configuration obsolètes ou mal nommés
- Problèmes de format YAML (indentation)
- Problèmes d'accès aux fichiers ou répertoires

Pour résoudre ces problèmes, corrigez le fichier de configuration et redémarrez Loki :

```bash
docker-compose restart loki
```

### Redémarrage complet de Loki

Si vous avez apporté des modifications importantes à la configuration, utilisez le script `docker-restart-loki.sh` :

```bash
chmod +x docker-restart-loki.sh
./docker-restart-loki.sh
```

Ce script arrête et supprime le conteneur Loki, corrige les permissions, et redémarre Loki avec la nouvelle configuration.

## Requêtes Loki dans Grafana

Loki utilise un langage de requête appelé LogQL, similaire à PromQL. Voici quelques exemples de requêtes utiles :

### Filtrer par job

```
{job="fhirhub-logs"}
```

### Filtrer par niveau de log

```
{job="fhirhub-logs", level="error"}
```

### Rechercher un texte spécifique

```
{job="fhirhub-logs"} |= "conversion error"
```

### Extraire et formater les données JSON

```
{job="fhirhub-conversion"} | json | status="error"
```

### Compter les erreurs par minute

```
sum(count_over_time({job="fhirhub-logs", level="error"}[1m])) by (service)
```

## Intégration avec les tableaux de bord Grafana

FHIRHub inclut plusieurs tableaux de bord Grafana préconfigurés pour visualiser les logs :

1. **FHIRHub - Logs API & Détails** - Vue générale des appels API avec possibilité de filtrer par endpoint, code de statut, etc.
2. **FHIRHub - Détails de Conversion** - Vue détaillée d'une conversion spécifique, avec le message HL7 d'entrée et le bundle FHIR de sortie

Ces tableaux de bord sont automatiquement provisionnés grâce aux fichiers dans `grafana/dashboards/` et `grafana/provisioning/`.

## Notes de maintenance

### Nettoyage des logs anciens

Par défaut, Loki ne supprime pas automatiquement les anciens logs. Si vous souhaitez configurer une rétention, modifiez ces paramètres dans `loki/loki-config.yaml` :

```yaml
table_manager:
  retention_deletes_enabled: true  # Activer la suppression des anciennes données
  retention_period: 744h  # Conserver les données pendant 31 jours (744 heures)
```

### Sauvegarde des données Loki

Pour sauvegarder les données Loki :

```bash
# Créer une sauvegarde des données Loki
mkdir -p backups/loki
docker run --rm -v loki_data:/data -v $(pwd)/backups/loki:/backup \
  alpine tar -zcf /backup/loki-$(date +%Y%m%d).tar.gz /data
```

### Mise à jour de Loki et Promtail

Pour mettre à jour Loki et Promtail vers les dernières versions :

```bash
# Mettre à jour les images
docker-compose pull loki promtail

# Redémarrer les services
docker-compose up -d loki promtail
```

## Conclusion

Loki et Promtail fournissent une solution puissante et légère pour la gestion des logs dans FHIRHub. Avec la configuration correcte, vous pouvez facilement collecter, stocker et analyser les logs de l'application, ce qui est essentiel pour le dépannage et la surveillance de la production.

Pour plus d'informations sur Loki, consultez la [documentation officielle de Loki](https://grafana.com/docs/loki/latest/).