# Réinitialisation des données FHIRHub

Ce document explique comment utiliser les scripts de réinitialisation des données pour FHIRHub. Ces scripts permettent de vider les dossiers de résultats de conversion et de réinitialiser les statistiques dans la base de données.

## Fichiers disponibles

- `reset-data.sh` : Script pour les installations standard (non-Docker)
- `reset-data-docker.sh` : Script pour les installations Docker

## Utilisation du script standard

Pour les installations standards (non-Docker), utilisez le script `reset-data.sh` :

```bash
./reset-data.sh
```

Ce script va :
1. Vider les dossiers `./data/conversions`, `./data/history` et `./data/outputs`
2. Réinitialiser les tables de la base de données SQLite (conversion_logs, api_activity_logs, system_logs liés aux conversions)
3. Créer une sauvegarde de la base de données avant toute modification
4. Proposer de redémarrer l'application si elle est en cours d'exécution

## Utilisation du script Docker

Pour les installations Docker, utilisez le script `reset-data-docker.sh` :

```bash
./reset-data-docker.sh
```

Ce script va :
1. Vider les dossiers de conversion à l'intérieur du conteneur Docker
2. Réinitialiser les tables de la base de données SQLite dans le conteneur
3. Proposer de redémarrer les conteneurs pour appliquer les changements

## Précautions

- Ces scripts demandent une confirmation avant d'effectuer toute opération.
- Une sauvegarde de la base de données est créée avant toute modification (pour le script standard).
- Les données supprimées ne peuvent pas être récupérées après l'opération.

## Exécution automatique

Pour exécuter le script automatiquement (par exemple via une tâche cron), vous pouvez utiliser l'option `-y` pour confirmer automatiquement toutes les actions :

```bash
./reset-data.sh -y
```

Ou pour Docker :

```bash
./reset-data-docker.sh -y
```

Cette option est particulièrement utile pour les tâches planifiées ou les scripts de maintenance automatisés. Par exemple, vous pouvez configurer une tâche cron pour réinitialiser les données chaque semaine :

```bash
# Exemple d'entrée crontab pour réinitialiser les données tous les dimanches à 2h du matin
0 2 * * 0 /chemin/vers/reset-data.sh -y >> /var/log/fhirhub-reset.log 2>&1
```

## En cas de problème

Si vous rencontrez des problèmes lors de l'exécution des scripts :

1. Vérifiez que vous avez les permissions nécessaires pour exécuter le script
2. Pour le script standard, assurez-vous que `sqlite3` est installé sur votre système
3. Pour le script Docker, assurez-vous que Docker et docker-compose sont installés et fonctionnels
4. Vérifiez que les chemins des fichiers dans le script correspondent à votre installation

Pour plus d'informations, consultez la documentation complète de FHIRHub.