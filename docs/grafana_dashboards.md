# Tableaux de bord Grafana

FHIRHub inclut des tableaux de bord Grafana préconfigurés pour surveiller les conversions HL7 vers FHIR et les performances du système.

## Accès aux tableaux de bord

1. Accédez à Grafana via `http://localhost:3000` (ou le port configuré)
2. Connectez-vous avec les identifiants par défaut :
   - Identifiant : admin
   - Mot de passe : admin123
3. Dans le menu de gauche, cliquez sur "Dashboards" puis "General" pour voir les tableaux de bord disponibles

## Tableaux de bord disponibles

### Logs de Conversion FHIRHub

Tableau de bord principal qui affiche une vue d'ensemble des métriques système et des conversions :

- **Nombre total de conversions** : Affiche le nombre de conversions réussies et en erreur
- **Utilisation CPU** : Suivi de l'utilisation CPU en pourcentage
- **Mémoire utilisée** : Suivi de la mémoire utilisée en MB
- **Connexions actives** : Nombre de connexions actives au serveur
- **Durée moyenne de conversion** : Temps moyen de traitement des conversions en millisecondes
- **Tableau de bord de conversion en temps réel** : Liste des dernières conversions avec leurs statuts
- **Logs de conversion en temps réel** : Affichage des logs bruts pour le débogage

### Logs FHIRHub (Détaillé)

Tableau de bord avancé offrant des options de filtrage et une analyse détaillée des logs :

- **Succès et erreurs de conversion** : Graphique montrant le ratio de succès/erreurs au fil du temps
- **Temps de traitement des conversions** : Évolution du temps de traitement
- **Dernières conversions** : Tableau détaillé avec informations complètes sur chaque conversion
- **Logs d'erreurs** : Section spécifique pour les erreurs, facilitant l'identification des problèmes

## Filtrage des logs

Pour filtrer les logs par date, heure ou type d'erreur :

1. Dans le coin supérieur droit de chaque tableau de bord, ajustez la plage de temps (ex : Last 6 hours, Today, etc.)
2. Pour le tableau "Logs FHIRHub (Détaillé)", utilisez les filtres disponibles :
   - Filtrage par niveau d'erreur : Cliquez sur le libellé "level" pour choisir (info, warning, error)
   - Filtrage par application : Cliquez sur le champ "application" pour filtrer par nom d'application
   - Recherche de texte : Utilisez le champ de recherche pour filtrer par contenu spécifique
   - Tri par colonne : Cliquez sur les en-têtes de colonne pour trier les résultats

## Créer des alertes

Vous pouvez configurer des alertes pour être notifié en cas de problème :

1. Survolez un panneau et cliquez sur le menu (trois points)
2. Sélectionnez "Edit"
3. Allez dans l'onglet "Alert"
4. Configurez les conditions d'alerte (ex : plus de 5 erreurs en 10 minutes)
5. Configurez les canaux de notification (email, Slack, etc.)

## Dépannage

Si les données n'apparaissent pas dans les tableaux de bord :

1. Assurez-vous que des conversions ont été effectuées récemment
2. Vérifiez que les sources de données sont configurées correctement :
   - Dans Grafana, allez dans Configuration > Data Sources
   - Vérifiez que Prometheus et Loki sont connectés et fonctionnels
3. Exécutez le script de redémarrage fourni :
   ```bash
   ./docker-restart-grafana.sh
   ```
4. Vérifiez que les services sont en cours d'exécution :
   ```bash
   docker ps | grep fhirhub
   ```
5. Consultez les logs des conteneurs pour identifier d'éventuels problèmes :
   ```bash
   docker logs fhirhub
   docker logs fhirhub-prometheus
   docker logs fhirhub-grafana
   ```

## Personnalisation des tableaux de bord

Vous pouvez personnaliser les tableaux de bord existants :

1. Survolez un panneau et cliquez sur "Edit" (icône crayon)
2. Modifiez les requêtes, visualisations ou options d'affichage
3. Cliquez sur "Apply" pour sauvegarder les modifications

Pour créer un nouveau tableau de bord :

1. Cliquez sur "+ Create Dashboard" dans le menu principal
2. Ajoutez des panneaux avec "+ Add panel"
3. Configurez chaque panneau selon vos besoins
4. Sauvegardez le tableau de bord avec "Save dashboard"

## Exportation des données

Pour exporter les données d'un tableau de bord :

1. Dans un panneau, cliquez sur le menu (trois points)
2. Sélectionnez "Inspect" puis "Data"
3. Choisissez le format d'exportation souhaité (CSV, Excel, etc.)
4. Cliquez sur "Download"

Pour générer un rapport PDF d'un tableau de bord complet :

1. Cliquez sur "Share" (icône de partage) en haut du tableau de bord
2. Sélectionnez "Export" puis "Export to PDF"
3. Configurez les options d'exportation
4. Cliquez sur "Save to PDF"