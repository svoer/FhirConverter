# FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

Service de conversion de messages HL7 v2.5 vers FHIR R4, compatible avec les terminologies et standards français définis par l'ANS (Agence du Numérique en Santé).

![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![FHIR](https://img.shields.io/badge/FHIR-R4%20(v4.0.1)-green)
![HL7](https://img.shields.io/badge/HL7-v2.5-orange)
![Terminologie](https://img.shields.io/badge/Terminologie-ANS-yellowgreen)

## Présentation

FHIRHub est un service complet de conversion des messages HL7 v2.5 vers le format FHIR R4 (v4.0.1), conforme aux exigences de l'Agence du Numérique en Santé (ANS) pour les systèmes de santé français. Cette solution permet l'interopérabilité des systèmes d'information de santé en France en assurant une conversion fiable et conforme aux standards.

## Fonctionnalités principales

- **Conversion HL7 vers FHIR**: Transformation complète et fidèle des messages HL7 v2.5 en ressources FHIR R4
- **Surveillance de répertoire**: Détection et traitement automatique des fichiers HL7 déposés dans un répertoire surveillé
- **API REST sécurisée**: Points d'accès API sécurisés par clé API pour l'intégration avec d'autres systèmes
- **Interface web**: Interface utilisateur intuitive pour le téléchargement de fichiers et la visualisation des résultats
- **Compatibilité française**: Intégration des systèmes de terminologie français (TRE-R316, TRE-R51, etc.)
- **Support des OIDs**: Prise en charge des OIDs standards français (1.2.250.1.213.x.x.x)
- **Intégration SMT**: Connexion avec le Serveur Multi-Terminologies (SMT) de l'ANS
- **Mode hors ligne**: Fonctionnement sans connexion internet grâce aux terminologies préchargées
- **Nettoyage intelligent**: Optimisation des ressources FHIR générées selon les bonnes pratiques

## Prérequis

- Node.js version 18 ou supérieure
- NPM ou Yarn

## Installation

1. Cloner le dépôt
2. Installer les dépendances : `npm install`
3. Configurer les répertoires d'entrée/sortie (si différents des valeurs par défaut)
4. Démarrer l'application : `npm start`

## Structure du projet

- `/data/in` : Répertoire surveillé pour les fichiers HL7 entrants
- `/data/out` : Répertoire pour les fichiers FHIR convertis
- `/french_terminology` : Données et mappings pour les terminologies françaises
- `/docs` : Documentation technique et des standards

## Outils de test et validation

Le projet inclut plusieurs outils pour tester et valider les fonctionnalités :

- `test_french_tools.sh` : Script interactif pour tester les terminologies françaises
- `verify_french_oids.js` : Outil de vérification de la cohérence des OIDs
- `test_french_terminology.js` : Tests unitaires pour les fonctions d'adaptation

Pour exécuter les tests :

```bash
# Rendre le script exécutable
chmod +x test_french_tools.sh

# Exécuter les tests
./test_french_tools.sh
```

## API REST

### API de Conversion

- `GET /api/status` : Vérifier l'état du serveur
- `GET /api/conversions` : Récupérer l'historique des conversions
- `GET /api/conversions/:id` : Obtenir une conversion spécifique
- `GET /api/stats` : Obtenir les statistiques de conversion
- `POST /api/convert` : Convertir du contenu HL7 en FHIR
- `POST /api/upload` : Télécharger et convertir un fichier HL7

### API de Surveillance

- `POST /api/monitor/start` : Démarrer la surveillance des fichiers
- `POST /api/monitor/stop` : Arrêter la surveillance des fichiers
- `POST /api/monitor/scan` : Analyser les fichiers existants

### API de Terminologie

- `GET /api/terminology/codesystem/:id` : Accéder à un système de code français
- `GET /api/terminology/search` : Rechercher dans les terminologies
- `GET /api/terminology/validate` : Valider un code dans un système
- `POST /api/terminology/validate-bundle` : Valider tous les codes dans un bundle FHIR
- `GET /api/terminology/configure` : Obtenir la configuration du service de terminologie
- `POST /api/terminology/configure` : Configurer l'authentification pour le SMT
- `GET /api/terminology/preload` : Précharger les terminologies françaises principales
- `GET /api/terminology/oid/:oid` : Obtenir un système de terminologie par son OID
- `GET /api/terminology/systems` : Lister tous les systèmes de terminologie disponibles

## Terminologies françaises

Le convertisseur est compatible avec les standards français, notamment :
- L'Identifiant National de Santé (INS)
- Les codes CCAM
- LOINC France
- NABM
- Terminologies ANS (Agence du Numérique en Santé)

## Exemples

### Conversion HL7 via API

```bash
curl -X POST http://localhost:5000/api/convert \
  -H "x-api-key: dev-key" \
  -H "Content-Type: text/plain" \
  --data-binary @path/to/hl7file.hl7
```

### Récupération d'un CodeSystem français

```bash
curl -X GET http://localhost:5000/api/terminology/codesystem/TRE_R11-CiviliteExercice \
  -H "x-api-key: dev-key"
```

### Validation d'un code dans un système de terminologie

```bash
curl -X GET "http://localhost:5000/api/terminology/validate?system=https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM&code=AHQP003" \
  -H "x-api-key: dev-key"
```

### Validation d'un bundle FHIR complet

```bash
curl -X POST http://localhost:5000/api/terminology/validate-bundle \
  -H "x-api-key: dev-key" \
  -H "Content-Type: application/json" \
  --data @path/to/fhir_bundle.json
```

### Recherche d'un système de terminologie par OID

```bash
curl -X GET http://localhost:5000/api/terminology/oid/1.2.250.1.213.2.5 \
  -H "x-api-key: dev-key"
```

### Liste de tous les systèmes de terminologie disponibles

```bash
curl -X GET http://localhost:5000/api/terminology/systems \
  -H "x-api-key: dev-key"
```

## Documentation technique

Pour des informations détaillées sur les services et fonctionnalités spécifiques, consultez les documents suivants :

- [Documentation des Terminologies Françaises](./docs_fr/TERMINOLOGIES.md) - Explique les modes en ligne/hors ligne et la configuration des services de terminologie

### Architecture du projet

Le projet FHIRHub est structuré en plusieurs modules complémentaires :

#### Module de conversion HL7 vers FHIR (`hl7ToFhirConverter.js`)
- Analyse syntaxique des messages HL7 v2.5
- Conversion vers les ressources FHIR R4 correspondantes
- Génération de bundle FHIR conforme à la spécification
- Gestion des identifiants uniques et références entre ressources

#### Module d'adaptation aux terminologies françaises (`french_terminology_adapter.js`)
- Adaptation des ressources FHIR aux systèmes de terminologie français
- Conversion des identifiants selon les standards ANS
- Intégration des extensions françaises (INS-C, INS-NIR, etc.)
- Support des OIDs officiels français

#### Service de terminologie (`french_terminology_service_offline.js`)
- Accès aux terminologies françaises en mode hors ligne
- Validation des codes selon les référentiels français
- Recherche par OID, identifiant ou description
- Gestion du cache pour optimiser les performances

#### Module de nettoyage FHIR (`fhir_cleaner.js`)
- Suppression des champs vides ou non significatifs
- Optimisation des ressources selon les bonnes pratiques FHIR
- Correction des références relatives
- Traitement spécifique pour chaque type de ressource

#### Serveur API REST (`api.js`)
- Points d'accès RESTful sécurisés
- Authentification par clé API
- Gestion des conversions et de l'historique
- Interface avec le convertisseur et les services de terminologie

#### Surveillance de fichiers (`fileMonitor.js`)
- Détection des nouveaux fichiers HL7
- Traitement automatique et conversion vers FHIR
- Gestion des erreurs et journalisation
- Organisation et archivage des fichiers

### Particularités des terminologies françaises

FHIRHub intègre les spécificités des systèmes de santé français, notamment :

#### Identifiant National de Santé (INS)
- Support complet de l'INS-NIR et INS-C
- Extensions françaises pour l'INS vérifié
- OIDs officiels (1.2.250.1.213.1.4.8 pour l'INS-NIR)
- Gestion de la qualité de l'identifiant selon les règles de l'ANS

#### Terminologies ANS
- TRE-R316-AutreCategorieEtablissement (OID: 1.2.250.1.213.1.6.1.239)
- TRE-R51-DESCGroupe2Diplome (OID: 1.2.250.1.213.1.6.1.49)
- TRE-G02-TypeProduit (OID: 1.2.250.1.71.1.2.2)
- TRE-R217-ProtectionJuridique (OID: 1.2.250.1.213.1.1.4.327)
- TRE-R302-ContexteCodeComplementaire (OID: 1.2.250.1.213.3.3.70)
- TRE-R239-PublicPrisEnCharge (OID: 1.2.250.1.213.3.3.29)
- TRE-A01-CadreExercice (OID: 1.2.250.1.213.1.1.4.9)

### Mise en œuvre et déploiement

#### Installation standard
```bash
# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer le fichier .env pour configurer les chemins et options

# Démarrer l'application
npm start
```

#### Déploiement Docker
```bash
# Construire l'image
docker build -t fhirhub .

# Lancer le conteneur
docker run -d -p 5000:5000 \
  -v /chemin/vers/data/in:/app/data/in \
  -v /chemin/vers/data/out:/app/data/out \
  --name fhirhub \
  fhirhub
```

#### Configuration du Serveur Multi-Terminologies (SMT)
Pour utiliser le SMT en ligne (au lieu des données préchargées) :

1. Créer un compte sur le portail ANS : https://esante.gouv.fr/
2. Demander les identifiants d'API pour le SMT
3. Modifier le fichier `french_terminology_adapter.js` pour utiliser le service en ligne
4. Configurer l'authentification dans `app.js` :

```javascript
const frenchTerminologyService = require('./french_terminology_service');
frenchTerminologyService.configureAuth({
  authEnabled: true,
  clientId: 'VOTRE_CLIENT_ID',      // Généralement "user-api"
  clientSecret: 'VOTRE_CLIENT_SECRET', 
  apiKey: 'VOTRE_CLE_API'           // Clé fournie par l'ANS
});
```

Pour plus de détails, consultez la [Documentation des Terminologies Françaises](./docs_fr/TERMINOLOGIES.md).

## Contribuer au projet

Les contributions sont les bienvenues ! Pour contribuer :

1. Forker le dépôt
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committer vos changements (`git commit -m 'Ajout de fonctionnalité X'`)
4. Pousser vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

### Directives de développement
- Commenter le code en français
- Suivre les conventions de nommage existantes
- Ajouter des tests unitaires pour les nouvelles fonctionnalités
- Respecter les standards FHIR R4 et les spécifications ANS

## Licence

Ce projet est sous licence MIT.

## Contact

Pour toute question ou suggestion concernant ce projet, veuillez contacter l'équipe de développement ou ouvrir une issue sur GitHub.