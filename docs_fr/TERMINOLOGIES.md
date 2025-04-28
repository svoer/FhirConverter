# Documentation du Service de Terminologie Française

## Introduction

FHIRHub intègre un service de terminologie spécifique à la santé française pour garantir la compatibilité des ressources FHIR générées avec les standards français. Ce document explique les différentes options de fonctionnement et comment configurer le service selon vos besoins.

## Architecture des Services de Terminologie

L'application propose **deux modes de fonctionnement** :

### 1. Mode Hors Ligne (Par défaut)

Le mode hors ligne utilise des fichiers JSON préchargés contenant les informations essentielles des terminologies standardisées françaises. Ce mode est activé par défaut et ne nécessite ni connexion internet, ni authentification.

**Fichier :** `french_terminology_service_offline.js`

**Avantages :**
- Fonctionne sans connexion internet
- Aucune authentification requise
- Performance optimale (pas de délai réseau)
- Parfait pour le déploiement chez les clients sans dépendances externes

**Limitations :**
- Terminologies potentiellement non à jour (selon la dernière mise à jour des fichiers JSON)
- Couverture limitée aux terminologies préchargées

### 2. Mode En Ligne

Le mode en ligne se connecte directement au Serveur Multi-Terminologies (SMT) de l'Agence du Numérique en Santé (ANS) pour accéder aux terminologies standardisées françaises en temps réel.

**Fichier :** `french_terminology_service.js`

**Avantages :**
- Terminologies toujours à jour
- Accès à l'ensemble des terminologies disponibles sur le SMT
- Validation des codes en temps réel

**Limitations :**
- Nécessite une connexion internet
- Requiert une authentification avec des identifiants valides auprès de l'ANS
- Performance dépendante de la qualité du réseau
- Nécessite une configuration supplémentaire

## Configuration du Service de Terminologie

### Utiliser le Mode Hors Ligne (Par défaut)

C'est la configuration actuelle par défaut, aucune modification n'est nécessaire.

### Passer au Mode En Ligne

Pour utiliser le mode en ligne, suivez ces étapes :

1. Modifiez le fichier `french_terminology_adapter.js` pour remplacer la ligne :
   ```javascript
   const terminologyService = require('./french_terminology_service_offline');
   ```
   par :
   ```javascript
   const terminologyService = require('./french_terminology_service');
   ```

2. Obtenez vos identifiants auprès de l'ANS :
   - Créez un compte sur https://esante.gouv.fr
   - Demandez une clé API pour le Serveur Multi-Terminologies (SMT)

3. Configurez l'authentification dans `app.js` en ajoutant après l'initialisation :
   ```javascript
   const frenchTerminologyService = require('./french_terminology_service');
   frenchTerminologyService.configureAuth({
     authEnabled: true,
     clientId: 'VOTRE_CLIENT_ID',       // Généralement "user-api"
     clientSecret: 'VOTRE_CLIENT_SECRET', 
     apiKey: 'VOTRE_CLE_API'            // Clé fournie par l'ANS
   });
   ```

## Terminologies Supportées

Les principales terminologies françaises supportées incluent :

- **TRE-R316-AutreCategorieEtablissement** (OID: 1.2.250.1.213.1.6.1.239)
- **TRE-R51-DESCGroupe2Diplome** (OID: 1.2.250.1.213.1.6.1.49)
- **TRE-G02-TypeProduit** (OID: 1.2.250.1.71.1.2.2)
- **TRE-R217-ProtectionJuridique** (OID: 1.2.250.1.213.1.1.4.327)
- **TRE-R302-ContexteCodeComplementaire** (OID: 1.2.250.1.213.3.3.70)
- **TRE-R239-PublicPrisEnCharge** (OID: 1.2.250.1.213.3.3.29)
- **TRE-A01-CadreExercice** (OID: 1.2.250.1.213.1.1.4.9)
- **TRE-R303-HL7v3AdministrativeGender** (correspondance avec les genres HL7v3)

## Systèmes d'Identifiants

Le service prend également en charge les systèmes d'identifiants français courants :

- **INS-NIR** (urn:oid:1.2.250.1.213.1.4.8)
- **INS-C** (urn:oid:1.2.250.1.213.1.4.2)
- **RPPS** (urn:oid:1.2.250.1.71.4.2.1)
- **ADELI** (urn:oid:1.2.250.1.71.4.2.2)
- **FINESS** (urn:oid:1.2.250.1.71.4.2.3)
- **SIRET** (urn:oid:1.2.250.1.71.4.2.4)

## Adaptation des Ressources FHIR

Le module `french_terminology_adapter.js` adapte automatiquement les ressources FHIR générées pour les rendre compatibles avec les terminologies françaises. Ce processus inclut :

1. Adaptation des identifiants patients (INS, etc.)
2. Adaptation des statuts de rencontre conformes à R4
3. Adaptation des rôles des praticiens (RPPS, etc.)
4. Adaptation des observations pour les laboratoires (LOINC/NABM)

## Mécanisme de Cache

Les deux modes (en ligne et hors ligne) utilisent un système de cache pour optimiser les performances :

- Les systèmes déjà consultés sont mis en cache
- Les validations de codes sont également mises en cache
- Les caches sont persistants entre les redémarrages de l'application

## Recommandation de Déploiement

Pour un déploiement en production chez un client :
- Utilisez le **mode hors ligne** (par défaut) pour éviter les dépendances externes
- Effectuez des mises à jour périodiques des fichiers de terminologie (tous les 6 mois)
- Ne basculez en mode en ligne que si vous avez besoin de fonctionnalités spécifiques non disponibles hors ligne