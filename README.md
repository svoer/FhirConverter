# FHIRHub - Convertisseur HL7v2 vers FHIR

FHIRHub est une application robuste et légère qui convertit les messages HL7v2.5 vers le format FHIR (standard R4 version 4.0.1). Ce projet est conçu comme une solution portable et déployable sans dépendances lourdes.

## Fonctionnalités clés

- Conversion de messages HL7v2.5 vers FHIR R4 (v4.0.1)
- Interface utilisateur moderne avec design en dégradé rouge-orange
- API REST sécurisée avec authentification JWT et clés API
- Base de données SQLite pour les logs et la persistance des données
- Terminologies médicales françaises préchargées
- Fonctionnement hors-ligne sans appels API externes
- Éditeur de workflow visuel (EAI)
- Export/import de templates en JSON
- Interface intuitive pour la conversion de messages et la visualisation des résultats

## Architecture optimisée

Cette version utilise une architecture Docker optimisée qui:

- Utilise des volumes Docker nommés pour une meilleure isolation et persistance des données
- Inclut uniquement les composants essentiels (application Node.js, base de données SQLite)
- Propose une solution légère sans services de monitoring supplémentaires

## Installation

### Prérequis

- Docker et Docker Compose (v2.0+)

### Installation et démarrage

```bash
# Cloner le dépôt (ou télécharger l'archive)
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Démarrer l'application avec Docker
docker-compose up -d
```

### Arrêt

```bash
docker-compose down
```

## Accès à l'application

- Interface Web: http://localhost:5001
- API: http://localhost:5001/api

**Important**: L'application utilise désormais le port 5001 (au lieu de 5000) pour éviter les conflits avec d'autres services.

## Identifiants par défaut

- Utilisateur: admin
- Mot de passe: admin123

## Structure des dossiers

- `data/` - Données persistantes pour les installations non-Docker
- `storage/` - Structure optimisée pour les données locales
  - `db/` - Base de données SQLite
  - `data/` - Conversions, historique et sorties
  - `logs/` - Journaux d'application
  - `backups/` - Sauvegardes automatiques
- `french_terminology/` - Terminologies médicales françaises
- `src/` - Code source de l'application
- `public/` - Fichiers statiques pour l'interface utilisateur
- `routes/` - Routes API
- `test_data/` - Données de test

## Réinitialisation des données

FHIRHub inclut des scripts pour réinitialiser les données de conversion:

- `reset-data.sh` - Pour installations standard (non-Docker)
- `reset-data-docker.sh` - Pour installations Docker
- `reset-docker-volumes.sh` - Pour nettoyer les volumes Docker nommés

Ces scripts supportent l'option `-y` pour une exécution non-interactive (compatible cron).

Pour plus d'informations, consultez `RESET_DATA_HELP.md`.

## Documentation technique

Pour plus de détails sur le fonctionnement interne du code, consultez la documentation technique disponible à l'adresse `/documentation.html` après le démarrage de l'application.

## Support et maintenance

Pour toute question ou assistance, consultez la documentation incluse ou contactez l'équipe de support.

---

© 2025 FHIRHub - Solution de conversion HL7 vers FHIR pour la santé numérique française