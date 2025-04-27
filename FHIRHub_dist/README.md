# FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

FHIRHub est une solution complète de conversion de messages HL7 v2.5 vers FHIR R4, spécialement adaptée au contexte français de la e-Santé.

## Caractéristiques principales

- Conversion complète des messages HL7 v2.5 vers FHIR R4 (v4.0.1)
- Support des terminologies et codifications françaises (ANS / ASIP Santé)
- Interface utilisateur intuitive et moderne
- API REST sécurisée par clé
- Base de données SQLite intégrée pour la persistance des logs de conversion
- Mode hors-ligne complet sans dépendances externes
- Support multiutilisateur avec authentification
- Adaptation aux spécificités françaises (INS, RPPS, etc.)

## Prérequis techniques

- Node.js 18.x ou supérieur
- 2 Go de RAM minimum
- 500 Mo d'espace disque

## Installation rapide

1. Décompressez l'archive dans un répertoire de votre choix
2. Ouvrez un terminal et naviguez vers ce répertoire
3. Installez les dépendances :
   ```
   npm install
   ```
4. Lancez l'application :
   ```
   ./start.sh
   ```
5. Accédez à l'interface via votre navigateur :
   ```
   http://localhost:5000
   ```

## Authentification

- **Administrateur** : admin / adminfhirhub
- **Utilisateur** : user / userfhirhub

## Structure du projet

- `app.js` : Application principale
- `api.js` : API REST
- `hl7ToFhirConverter.js` : Moteur de conversion
- `french_terminology_*.js` : Services d'adaptation aux terminologies françaises
- `data/` : Répertoires de stockage des fichiers
  - `data/in/` : Fichiers HL7 d'entrée
  - `data/out/` : Fichiers FHIR de sortie
  - `data/uploads/` : Fichiers téléchargés via l'interface
- `frontend/` : Interface utilisateur

## Utilisation de l'API

### Conversion d'un message HL7

```bash
curl -X POST -H "Content-Type: text/plain" -H "x-api-key: dev-key" -d @exemple.hl7 http://localhost:5000/api/convert
```

### Uploadd'un fichier HL7

```bash
curl -X POST -H "x-api-key: dev-key" -F "file=@exemple.hl7" http://localhost:5000/api/upload
```

### Obtenir l'historique des conversions

```bash
curl -H "x-api-key: dev-key" http://localhost:5000/api/conversions
```

## Exemples fournis

- `exemple.hl7` : Exemple simple de message HL7 v2.5 (ADT^A01)
- `exemple_avance.hl7` : Exemple complexe avec segments ROL, NK1 et IN1

## Adaptation française

FHIRHub implémente les recommandations de l'ANS (Agence du Numérique en Santé) pour l'utilisation de FHIR en France, notamment :

- Support des identifiants nationaux (INS, RPPS, ADELI, FINESS)
- Intégration des terminologies françaises (TRE-R316, TRE-R51, etc.)
- Format des numéros de téléphone français (+33)
- OIDs spécifiques au système de santé français

## Configuration

La configuration s'effectue via l'interface administrateur (port, gestion des API keys, etc.).

## Support

Pour toute question technique, veuillez consulter la documentation ou contacter votre administrateur système.

---

© 2025 FHIRHub - Tous droits réservés