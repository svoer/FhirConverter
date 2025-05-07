# Workflows dans FHIRHub

Ce document explique le système de workflows dans FHIRHub, qui permet de créer des flux de traitement personnalisés pour les messages HL7.

## Concept de workflow

Un workflow dans FHIRHub est une séquence d'opérations qui peut être appliquée à un message HL7 pour effectuer des transformations, des validations, des routages ou d'autres traitements. Les workflows sont représentés visuellement dans l'interface et peuvent être créés sans programmation.

## Interface de workflows

L'interface de workflows de FHIRHub est basée sur un éditeur visuel avec des nœuds et des connexions :

- **Nœuds** : Représentent des actions ou des conditions
- **Connexions** : Définissent le flux entre les nœuds
- **Entrées/Sorties** : Points de connexion entre les nœuds
- **Panneaux de configuration** : Permettent de configurer les paramètres de chaque nœud

L'interface utilise une apparence avec dégradé rouge-orange conforme à la charte graphique de l'application.

## Types de nœuds disponibles

### Nœuds d'entrée/sortie

- **Réception HL7** : Point d'entrée pour les messages HL7
- **Sortie FHIR** : Point de sortie générant des ressources FHIR
- **Réponse API** : Renvoie une réponse à l'appelant de l'API
- **Journalisation** : Enregistre des informations dans les logs

### Nœuds de transformation

- **Conversion HL7 vers FHIR** : Convertit un message HL7 en ressources FHIR
- **Transformation du message** : Modifie le message HL7 selon des règles définies
- **Filtrage de segments** : Filtre les segments HL7 selon des critères
- **Enrichissement de données** : Ajoute des informations au message depuis des sources externes

### Nœuds de condition

- **Vérification de type de message** : Vérifie le type du message HL7 (ADT, ORU, etc.)
- **Vérification de contenu** : Vérifie la présence ou la valeur de certains champs
- **Validation selon profil** : Valide le message contre un profil HL7 ou FHIR
- **Branchement conditionnel** : Oriente le flux selon une condition

### Nœuds d'intégration

- **Appel REST** : Effectue un appel à une API REST externe
- **Appel SOAP** : Effectue un appel à un service SOAP
- **SFTP** : Envoie ou récupère des fichiers via SFTP
- **MLLP** : Envoie des messages via le protocole MLLP
- **Base de données** : Interagit avec une base de données externe

### Nœuds spécialisés

- **Intégration SIH** : Nœuds spécifiques pour l'intégration avec les systèmes hospitaliers
- **Traitement DICOM** : Nœuds pour le traitement des données d'imagerie médicale
- **Analyse IA** : Utilise l'IA pour analyser les messages
- **Routage intelligent** : Détermine dynamiquement la destination du message

## Création d'un workflow

Pour créer un workflow :

1. Accéder à la section "Workflows" dans l'interface
2. Cliquer sur "Nouveau workflow"
3. Glisser-déposer les nœuds depuis la palette
4. Connecter les nœuds pour définir le flux
5. Configurer chaque nœud selon les besoins
6. Tester le workflow avec des messages d'exemple
7. Activer le workflow pour l'utilisation en production

## Exemple de workflow : Triage de messages ADT

Voici un exemple de workflow pour le triage des messages ADT :

1. **Réception HL7** : Point d'entrée du message
2. **Vérification de type de message** : Vérifie si c'est un message ADT
   - Si oui, continuer
   - Si non, rediriger vers un autre workflow
3. **Transformation du message** : Normalise les identifiants patient
4. **Conversion HL7 vers FHIR** : Convertit le message en ressources FHIR
5. **Validation selon profil** : Vérifie la conformité avec les profils français
   - Si valide, continuer
   - Si invalide, envoyer à la correction manuelle
6. **Sortie FHIR** : Génère le Bundle FHIR final
7. **Journalisation** : Enregistre l'opération dans les logs

## Import/Export de templates

Les workflows peuvent être exportés sous forme de templates JSON pour être partagés ou réutilisés :

- **Export** : Génère un fichier JSON contenant la définition complète du workflow
- **Import** : Charge un workflow à partir d'un fichier JSON
- **Bibliothèque de templates** : FHIRHub inclut des templates préconfigurés pour les cas d'usage courants

## Exécution et surveillance

L'exécution des workflows peut être surveillée en temps réel :

- **État d'exécution** : Affiche les workflows actifs/inactifs
- **Statistiques** : Nombre de messages traités, temps moyen, taux d'erreur
- **Historique d'exécution** : Journal des exécutions précédentes avec détails
- **Alertes** : Notification en cas d'erreur ou d'événement important

## Sécurité des workflows

La sécurité est intégrée à tous les niveaux dans les workflows :

- **Validation des entrées** : Toutes les entrées sont validées pour éviter les injections
- **Isolation des exécutions** : Chaque exécution de workflow est isolée
- **Limites de ressources** : Des limites sont imposées pour éviter l'épuisement des ressources
- **Journalisation complète** : Toutes les actions sont enregistrées pour l'audit