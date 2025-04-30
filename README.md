# FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

![FHIRHub Logo](/public/img/flame-icon-white.svg)

## Le futur du partage de données santé, dès aujourd'hui.

FHIRHub est une solution complète pour convertir vos messages HL7 v2.5 en ressources FHIR R4, compatible avec les spécifications françaises de l'ANS (Agence du Numérique en Santé).

## Caractéristiques

- Conversion complète de messages HL7 v2.5 vers FHIR R4
- Support des terminologies françaises (compatible ANS)
- Interface utilisateur intuitive pour la conversion directe
- API REST sécurisée avec authentification par clé API
- Gestion des applications et des utilisateurs
- Journalisation et suivi des conversions
- Documentation Swagger intégrée
- Environnement entièrement portable avec SQLite

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-organisation/fhirhub.git
cd fhirhub

# Installer les dépendances
npm install

# Démarrer l'application
npm start
```

## Utilisation

Accédez à l'application via `http://localhost:5000` et connectez-vous avec les identifiants par défaut:

- Identifiant: admin
- Mot de passe: adminfhirhub

## Structure du Projet

```
fhirhub/
├── api/                    # Modules API
├── data/                   # Stockage SQLite et logs
├── french_terminology/     # Mappings pour terminologies françaises
├── middleware/             # Middleware Express
├── public/                 # Interface utilisateur
├── routes/                 # Routes Express
├── src/                    # Code source principal
├── utils/                  # Utilitaires et fonctions d'aide
├── app.js                  # Point d'entrée principal
├── hl7Parser.js            # Parseur HL7 optimisé
├── hl7ToFhirAdvancedConverter.js  # Convertisseur HL7 vers FHIR
└── server.js               # Configuration du serveur
```

## Développement

Pour le développement, vous pouvez utiliser les commandes suivantes:

```bash
# Lancer en mode développement avec hot-reload
npm run dev

# Exécuter les tests
npm test
```

## Mise à jour des terminologies ANS

Les fichiers de terminologie française se trouvent dans le dossier `french_terminology/`. Voici les principaux fichiers que vous pouvez mettre à jour:

### Fichiers de terminologie:

- `french_terminology/ans_common_codes.json` - Codes communs de l'ANS (mouvements, professions, etc.)
- `french_terminology/ans_oids.json` - Liste des OIDs français pour les identifiants
- `french_terminology/ans_terminology_systems.json` - Systèmes de terminologie français
- `french_terminology/fhir_r4_french_systems.json` - Systèmes FHIR R4 français

### Outils de mise à jour:

- `get_french_terminology.py` - Script pour récupérer les dernières terminologies depuis l'API de l'ANS
- `extract_french_systems.py` - Script pour extraire et organiser les systèmes français

Pour mettre à jour les terminologies, exécutez:

```bash
# Récupérer les dernières terminologies
python get_french_terminology.py

# Extraire et organiser les systèmes pertinents
python extract_french_systems.py
```

## Licence

Ce projet est distribué sous licence [MIT](LICENSE).

## Support

Pour toute question ou assistance, contactez notre équipe de support à [support@fhirhub.example.com](mailto:support@fhirhub.example.com).