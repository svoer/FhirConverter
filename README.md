# FHIRHub - Convertisseur HL7v2 vers FHIR

FHIRHub est une application robuste et légère qui convertit les messages HL7v2.5 vers le format FHIR (standard R4 version 4.0.1). Ce projet est conçu comme une solution portable et déployable sans dépendances lourdes.

## Fonctionnalités clés

- Conversion de messages HL7v2.5 vers FHIR R4 (v4.0.1)
- Interface utilisateur moderne avec design en dégradé rouge-orange
- API REST sécurisée avec authentification JWT et clés API
- Base de données SQLite pour les logs et la persistance des données
- Terminologies médicales françaises préchargées
- Fonctionnement hors-ligne sans appels API externes
- Support pour les workflows personnalisés (EAI)
- Export/import de templates en JSON
- Interface intuitive pour la conversion de messages et la visualisation des résultats

## Architecture simplifiée

Cette version utilise une architecture Docker simplifiée qui inclut uniquement les composants essentiels :

- Application Node.js principale
- Base de données SQLite intégrée
- Volume de données persistant

Les services non essentiels (Grafana, Prometheus, Loki) ont été supprimés pour une empreinte plus légère et un déploiement simplifié.

## Installation

### Prérequis

- Docker et Docker Compose

### Installation automatique

```bash
./docker-init-simple.sh
```

### Démarrage

```bash
./start-minimal.sh
```

### Arrêt

```bash
./stop-minimal.sh
```

## Accès à l'application

- Interface Web: http://localhost:3000
- API: http://localhost:3000/api

## Identifiants par défaut

- Utilisateur: admin
- Mot de passe: admin123

## Structure des dossiers

- `data/` - Données persistantes (base de données SQLite, terminologies, logs)
- `src/` - Code source de l'application
- `public/` - Fichiers statiques pour l'interface utilisateur
- `routes/` - Routes API
- `test_data/` - Données de test

## Gestion des données

Toutes les données sont stockées localement dans le dossier du projet, assurant qu'aucune information n'est perdue lors des mises à jour.

## Documentation technique

Pour plus de détails sur le fonctionnement interne du code, consultez la documentation technique disponible à l'adresse `/api-reference.html` après le démarrage de l'application.

## Support et maintenance

Pour toute question ou assistance, consultez la documentation incluse ou contactez l'équipe de support.

---

© 2025 FHIRHub - Solution de conversion HL7 vers FHIR pour la santé numérique française