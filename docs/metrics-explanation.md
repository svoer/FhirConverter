# Explication des métriques de FHIRHub

Ce document explique les différentes métriques affichées dans les tableaux de bord Grafana de FHIRHub.

## Métriques principales

### Conversions HL7 vers FHIR
Ce graphique montre le nombre de conversions effectuées au cours du temps. Un pic indique une utilisation intensive du service de conversion.

### API Requests
Ce graphique montre le nombre total de requêtes API reçues par le serveur FHIRHub. Cela inclut toutes les interactions avec l'API, pas seulement les conversions.

## Métriques en temps réel

### Temps moyen de conversion (s)
Indique le temps moyen qu'il faut pour convertir un message HL7 en ressources FHIR. Un temps plus bas indique de meilleures performances.

### Utilisation mémoire (MB)
Affiche la consommation de mémoire du serveur FHIRHub en mégaoctets. Une utilisation élevée peut indiquer des fuites de mémoire ou un volume important de trafic.

### Utilisation CPU (%)
Indique le pourcentage d'utilisation du CPU par le serveur FHIRHub. Une utilisation élevée peut indiquer un besoin de ressources supplémentaires ou des processus gourmands en CPU.

### Connexions Actives
**Cette métrique représente le nombre total de connexions simultanées au serveur FHIRHub**. Cela inclut :

- Connexions HTTP ouvertes par les clients
- Connexions à la base de données
- Sockets ouverts pour les communications internes
- Connexions WebSocket pour les notifications en temps réel
- Connexions aux services externes (comme les fournisseurs d'IA)

Un nombre élevé de connexions actives n'est pas nécessairement problématique. C'est un indicateur de la charge actuelle du système. **Dans une installation Docker locale avec peu d'utilisateurs, vous devriez généralement observer entre 5 et 20 connexions actives** en fonction des services en cours d'exécution. Des valeurs anormalement élevées (plus de 50) dans un environnement local indiquent généralement un problème avec la collecte des métriques.

## Utilisation des métriques

Ces métriques peuvent être utilisées pour :

1. **Surveillance des performances** : Identifier les goulets d'étranglement et les problèmes de performance.
2. **Planification des capacités** : Déterminer quand une mise à l'échelle est nécessaire.
3. **Débogage** : Identifier les problèmes potentiels en cas de dégradation des performances.
4. **Optimisation** : Trouver des opportunités d'amélioration des performances.

Pour réinitialiser les compteurs de métriques en cas de problème :

1. **Pour réinitialiser seulement les métriques Prometheus** (graphiques Grafana) sans toucher aux statistiques dans la base de données, utilisez le script `reset-prometheus-metrics.sh` fourni avec FHIRHub.

2. **Pour une réinitialisation complète des statistiques et des métriques**, utilisez le script `reset-stats-docker.sh` fourni avec FHIRHub.