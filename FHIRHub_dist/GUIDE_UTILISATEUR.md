# Guide Utilisateur FHIRHub

## Convertisseur HL7 v2.5 vers FHIR R4

Version 1.0.0  
Date: Avril 2025

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Installation](#2-installation)
3. [Connexion à l'application](#3-connexion-à-lapplication)
4. [Interface d'administration](#4-interface-dadministration)
5. [Gestion des applications](#5-gestion-des-applications)
6. [Gestion des clés API](#6-gestion-des-clés-api)
7. [Conversion HL7 vers FHIR](#7-conversion-hl7-vers-fhir)
8. [API REST](#8-api-rest)
9. [Dépannage](#9-dépannage)
10. [Annexes](#10-annexes)

---

## 1. Introduction

FHIRHub est une solution complète pour la conversion de messages HL7 v2.5 vers le format FHIR R4, spécialement adaptée aux systèmes de santé français. L'application permet une intégration simple via une API REST sécurisée et propose une interface utilisateur moderne pour tester et visualiser les conversions.

### Caractéristiques principales

- Conversion HL7 v2.5 vers FHIR R4 (compatible ANS)
- Support complet des terminologies et identifiants français
- Fonctionnement 100% hors-ligne sans dépendances externes
- Base de données SQLite intégrée pour une portabilité maximale
- Authentification à deux niveaux (Administrateur et Utilisateur)
- Gestion d'applications multiples avec paramètres personnalisables
- Génération et gestion de clés API
- Historique et statistiques des conversions
- Interface utilisateur en français

---

## 2. Installation

### Prérequis

- Node.js 18.x ou supérieur
- 2 Go d'espace disque minimum
- 4 Go de RAM recommandés

### Procédure d'installation

1. Décompressez l'archive FHIRHub dans le répertoire de votre choix
2. Ouvrez un terminal et naviguez vers ce répertoire
3. Accordez les droits d'exécution au script de démarrage :
   ```
   chmod +x start.sh
   ```
4. Lancez l'application :
   ```
   ./start.sh
   ```
5. L'application est accessible par défaut à l'adresse http://localhost:5000

### Configuration avancée

Si vous souhaitez modifier les paramètres par défaut (port, clé JWT, etc.), éditez le fichier `start.sh`.

---

## 3. Connexion à l'application

À la première exécution, deux comptes sont automatiquement créés :

- **Administrateur**
  - Identifiant : `admin`
  - Mot de passe : `adminfhirhub`
  
- **Utilisateur standard**
  - Identifiant : `user`
  - Mot de passe : `userfhirhub`

> **Important** : Pour des raisons de sécurité, modifiez ces mots de passe après la première connexion.

---

## 4. Interface d'administration

L'interface d'administration est accessible uniquement aux utilisateurs avec le rôle "admin". Elle permet de gérer :

- Les utilisateurs (création, modification, suppression)
- Les applications (création, configuration, suppression)
- Les clés API (génération, révocation)
- Les statistiques globales du système

### Tableau de bord

Le tableau de bord présente les informations système importantes :

- Utilisation CPU et mémoire
- Espace disque disponible
- Nombre de conversions par jour/semaine
- Statistiques des applications actives
- Dernières erreurs de conversion

---

## 5. Gestion des applications

Une "application" dans FHIRHub représente un système externe qui utilisera les services de conversion. Chaque application peut avoir :

- Un nom et une description
- Des paramètres personnalisables
- Une ou plusieurs clés API
- Des dossiers associés pour le traitement automatique
- Une durée de rétention des données spécifique

### Création d'une application

1. Accédez à "Applications" dans le menu principal
2. Cliquez sur "Nouvelle application"
3. Complétez le formulaire :
   - Nom (obligatoire)
   - Description
   - Durée de rétention des logs (en jours)
4. Cliquez sur "Créer"

### Configuration des paramètres

Pour chaque application, vous pouvez définir des paramètres personnalisables :

1. Accédez à la page de détails de l'application
2. Allez à l'onglet "Paramètres"
3. Cliquez sur "Ajouter un paramètre"
4. Spécifiez :
   - Clé (obligatoire)
   - Valeur (obligatoire)
   - Type (chaîne, nombre, booléen)
   - Description

### Association des dossiers

Pour associer un dossier à surveiller à une application :

1. Accédez à la page de détails de l'application
2. Allez à l'onglet "Dossiers"
3. Cliquez sur "Ajouter un dossier"
4. Spécifiez le chemin complet du dossier et une description

---

## 6. Gestion des clés API

Chaque application nécessite au moins une clé API pour accéder aux services de conversion.

### Génération d'une clé API

1. Accédez à la page de détails de l'application
2. Allez à l'onglet "Clés API"
3. Cliquez sur "Nouvelle clé API"
4. Spécifiez :
   - Description (ex: "Production", "Test", etc.)
   - Environnement (développement, qualification, production)
   - Date d'expiration (optionnel)
5. Cliquez sur "Générer"

> **Important** : Copiez immédiatement la clé API générée, elle ne sera plus affichée complètement pour des raisons de sécurité.

### Révocation d'une clé API

Pour révoquer une clé API (la rendre inutilisable) :

1. Accédez à l'onglet "Clés API" de l'application
2. Localisez la clé concernée
3. Cliquez sur "Révoquer"
4. Confirmez l'action

---

## 7. Conversion HL7 vers FHIR

FHIRHub propose plusieurs méthodes pour convertir des messages HL7 v2.5 en ressources FHIR R4 :

### Via l'interface utilisateur

1. Accédez à la page "Conversion"
2. Saisissez ou collez votre message HL7 dans la zone de texte
3. Cliquez sur "Convertir"
4. Le résultat FHIR s'affiche dans la zone de droite
5. Utilisez le bouton "Copier" pour copier le résultat

### Via téléchargement de fichier

1. Accédez à la page "Conversion"
2. Cliquez sur "Importer un fichier"
3. Sélectionnez votre fichier HL7
4. Le résultat FHIR s'affiche après la conversion

### Consultation de l'historique

Pour consulter l'historique des conversions :

1. Accédez à la page "Historique"
2. Filtrez par date, application ou statut
3. Cliquez sur une conversion pour voir les détails
4. Vous pouvez télécharger le message HL7 original et le résultat FHIR

---

## 8. API REST

L'API REST permet d'intégrer FHIRHub à vos applications. Toutes les requêtes nécessitent une clé API valide.

### Authentification

Toutes les requêtes API doivent inclure la clé API dans l'en-tête HTTP `X-API-Key` :

```
X-API-Key: votre-clé-api
```

### Endpoints principaux

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/status` | Vérifier l'état du service |
| POST | `/api/convert` | Convertir un message HL7 en FHIR |
| POST | `/api/upload` | Télécharger et convertir un fichier HL7 |
| GET | `/api/stats` | Obtenir des statistiques de conversion |

### Exemples de requêtes

#### Conversion d'un message HL7

```bash
curl -X POST http://localhost:5000/api/convert \
  -H "Content-Type: text/plain" \
  -H "X-API-Key: votre-clé-api" \
  -d 'MSH|^~\&|ACME|ACME-FACILITY|LAB|LAB-FACILITY|20230401000000||ADT^A01|...'
```

#### Téléchargement d'un fichier

```bash
curl -X POST http://localhost:5000/api/upload \
  -H "X-API-Key: votre-clé-api" \
  -F "file=@chemin/vers/votre/fichier.hl7"
```

#### Récupération des statistiques

```bash
curl -X GET "http://localhost:5000/api/stats?start_date=2025-01-01" \
  -H "X-API-Key: votre-clé-api"
```

Consultez la documentation API complète pour plus d'informations.

---

## 9. Dépannage

### Problèmes courants

| Problème | Cause probable | Solution |
|----------|----------------|----------|
| Impossible de se connecter | Mot de passe incorrect | Vérifiez vos identifiants |
| Échec de conversion | Message HL7 mal formaté | Vérifiez la syntaxe du message |
| API inaccessible | Clé API révoquée ou expirée | Générez une nouvelle clé API |
| Application indisponible | Port déjà utilisé | Changez le port dans `start.sh` |

### Journaux

Les journaux du système sont stockés dans le répertoire `data/logs`. Consultez-les pour diagnostiquer les problèmes.

### Sauvegarde des données

Pour sauvegarder toutes les données, sauvegardez le répertoire `data`. Il contient :
- La base de données SQLite (`fhirhub.db`)
- Les fichiers de conversion
- Les journaux système

---

## 10. Annexes

### Terminologies françaises supportées

FHIRHub intègre les terminologies officielles de l'Agence du Numérique en Santé, notamment :

- TRE-R316-AutreCategorieEtablissement (OID: 1.2.250.1.213.1.6.1.239)
- TRE-R51-DESCGroupe2Diplome (OID: 1.2.250.1.213.1.6.1.49)
- TRE-G02-TypeProduit (OID: 1.2.250.1.71.1.2.2)
- TRE-R217-ProtectionJuridique (OID: 1.2.250.1.213.1.1.4.327)
- TRE-R302-ContexteCodeComplementaire (OID: 1.2.250.1.213.3.3.70)
- TRE-R239-PublicPrisEnCharge (OID: 1.2.250.1.213.3.3.29)
- TRE-A01-CadreExercice (OID: 1.2.250.1.213.1.1.4.9)
- TRE-R303-HL7v3AdministrativeGender

### Systèmes d'identifiants français supportés

- INS (NIR) - OID: 1.2.250.1.213.1.4.8
- IPP - OID: 1.2.250.1.213.1.4.10
- RPPS - OID: 1.2.250.1.71.4.2.1
- ADELI - OID: 1.2.250.1.71.4.2.2
- FINESS - OID: 1.2.250.1.71.4.2.2

---

Pour toute question ou assistance supplémentaire, contactez notre équipe support.