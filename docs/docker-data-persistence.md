# Guide de persistance des données pour FHIRHub Docker

## Problème : Perte de données lors du redémarrage Docker

Lorsque vous redémarrez Docker avec `docker-compose down` suivi de `docker-compose up -d`, il peut arriver que vous perdiez des données. Ce document explique pourquoi ce problème se produit et comment le résoudre.

## Causes possibles

1. **Permissions incorrectes sur les volumes** : Si les permissions sur les volumes ne sont pas correctement configurées, le conteneur ne peut pas écrire dans les volumes.
2. **Volumes mal montés** : Les volumes peuvent ne pas être correctement montés dans Docker.
3. **Chemins incorrects dans l'application** : L'application peut utiliser des chemins absolus au lieu de relatifs.

## Solutions

### Option 1 : Utiliser le script de redémarrage sécurisé

Le script `docker-safe-restart.sh` a été créé pour arrêter et redémarrer les conteneurs Docker en toute sécurité, en s'assurant que les données sont persistantes.

```bash
./docker-safe-restart.sh
```

Ce script effectue les actions suivantes :
1. Sauvegarde automatique des données actuelles
2. Arrêt propre des conteneurs
3. Vérification et préparation des volumes (permissions)
4. Redémarrage des conteneurs
5. Vérification de l'état des conteneurs
6. Restauration des données si nécessaire

### Option 2 : Sauvegarde et restauration manuelles

Si vous préférez gérer manuellement la sauvegarde et la restauration :

1. Avant d'arrêter Docker, sauvegardez vos données :
   ```bash
   ./backup-docker-data.sh
   ```

2. Arrêtez et redémarrez Docker :
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. Si nécessaire, restaurez vos données :
   ```bash
   ./restore-docker-data.sh ./volumes/backups/20250507_123456
   ```
   (Remplacez le chemin par celui indiqué lors de la sauvegarde)

### Option 3 : Correction manuelle des volumes

Si les scripts ci-dessus ne résolvent pas le problème, vous pouvez essayer une correction manuelle :

1. Arrêtez Docker :
   ```bash
   docker-compose down
   ```

2. Corrigez les permissions des volumes :
   ```bash
   mkdir -p volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana
   chmod -R 777 volumes/db volumes/data volumes/logs volumes/backups volumes/french_terminology volumes/prometheus volumes/grafana
   ```

3. Redémarrez Docker :
   ```bash
   docker-compose up -d
   ```

## Vérification de la persistance des données

Pour vérifier que vos données sont correctement sauvegardées :

1. Connectez-vous à l'application FHIRHub
2. Créez une nouvelle application ou clé API
3. Arrêtez et redémarrez Docker avec le script sécurisé
4. Vérifiez que votre application ou clé API est toujours présente

## Bonnes pratiques

1. **Toujours utiliser le script sécurisé** pour redémarrer Docker
2. **Effectuer des sauvegardes régulières** avec `backup-docker-data.sh`
3. **Vérifier les logs** en cas de problème : `docker logs fhirhub`
4. **Ne jamais supprimer les volumes** sauf si vous êtes sûr de ne pas avoir besoin des données

## Note technique

Le paramètre `DB_PERSISTENT=true` a été ajouté à la configuration Docker pour indiquer explicitement à l'application que la base de données doit être persistante. Cela permet à l'application de s'assurer que les données sont correctement synchronisées avec le disque après chaque opération.

Les volumes ont également été modifiés pour utiliser le mode `:rw` (read-write) explicitement, garantissant que le conteneur peut à la fois lire et écrire dans les volumes.