# Architecture de FHIRHub

Ce document décrit l'architecture technique de l'application FHIRHub.

## Vue d'ensemble

FHIRHub est une application Node.js qui utilise une architecture modulaire pour assurer la flexibilité et la maintenabilité du code. L'application se compose des éléments suivants :

- Serveur Express.js pour l'API REST
- Interface utilisateur en HTML/CSS/JavaScript
- Base de données SQLite pour le stockage
- Moteur de conversion HL7 vers FHIR
- Système de gestion des terminologies françaises
- Moteur de workflow visuel
- Système d'authentification et d'autorisation
- Intégration avec des services d'IA (Mistral AI, etc.)

## Structure des dossiers

L'application est organisée selon la structure suivante :

- `/public` : Fichiers statiques de l'interface utilisateur
- `/routes` : Routes de l'API REST
- `/src` : Code source de l'application
  - `/src/services` : Services métier
  - `/src/db` : Couche d'accès aux données
  - `/src/utils` : Utilitaires
  - `/src/models` : Modèles de données
- `/middleware` : Middlewares Express
- `/docs` : Documentation technique
- `/storage` : Données persistantes
  - `/storage/db` : Fichiers de base de données
  - `/storage/logs` : Journaux
  - `/storage/backups` : Sauvegardes
  - `/storage/data` : Données de l'application

## Base de données

FHIRHub utilise SQLite comme moteur de base de données principal. Le fichier de base de données est stocké dans `/storage/db/fhirhub.db`. Les principales tables sont :

- `users` : Utilisateurs de l'application
- `applications` : Applications enregistrées
- `api_keys` : Clés API pour l'accès aux services
- `conversion_logs` : Journal des conversions effectuées
- `workflows` : Flux de travail configurés
- `ai_providers` : Fournisseurs d'IA configurés

## Sécurité

La sécurité est assurée par :

- Authentification par JWT (JSON Web Tokens)
- Validation des clés API
- Hachage des mots de passe avec sel
- Contrôle d'accès basé sur les rôles
- Validation des entrées et sortie
- Protection CSRF
- En-têtes de sécurité HTTP

## API

L'API REST est organisée en plusieurs groupes :

- `/api/convert` : Conversion HL7 vers FHIR
- `/api/applications` : Gestion des applications
- `/api/api-keys` : Gestion des clés API
- `/api/users` : Gestion des utilisateurs
- `/api/auth` : Authentification
- `/api/workflows` : Gestion des workflows
- `/api/terminology` : Accès aux terminologies
- `/api/ai` : Services d'intelligence artificielle
- `/api/documentation` : Accès à la documentation technique