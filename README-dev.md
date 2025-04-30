# Structure de répertoires recommandée pour FHIRHub

Pour assurer une organisation cohérente et maintenir les meilleures pratiques, voici la structure recommandée pour le projet FHIRHub :

```
/
├── api/                  # Code pour la gestion des API REST
│   ├── routes/           # Définitions des routes API
│   ├── controllers/      # Logique de contrôleur pour les routes
│   └── middleware/       # Middleware spécifique aux API
├── src/                  # Code source principal de l'application
│   ├── converters/       # Convertisseurs HL7 vers FHIR
│   │   ├── hl7ToFhirConverter.js          # Version en camelCase (utiliser celle-ci)
│   │   └── HL7ToFHIRConverter.js          # Liaison pour rétrocompatibilité
│   ├── utils/            # Utilitaires partagés
│   ├── services/         # Services métier
│   └── terminology/      # Gestion des terminologies
│       └── french/       # Terminologies françaises spécifiques
├── middleware/           # Middleware application (authentification, etc.)
├── public/               # Fichiers statiques pour le frontend
│   ├── css/              # Feuilles de style
│   ├── js/               # JavaScript frontend
│   └── img/              # Images et ressources
├── data/                 # Données persistantes
│   ├── conversions/      # Historique des conversions
│   ├── outputs/          # Fichiers de sortie générés
│   └── db/               # Fichiers de base de données SQLite
├── test/                 # Tests automatisés
│   ├── unit/             # Tests unitaires
│   └── integration/      # Tests d'intégration
└── docs/                 # Documentation
```

## Recommandations pour le nommage des fichiers

1. Utilisez toujours la convention de nommage camelCase pour les fichiers JavaScript
   - Bon: `hl7ToFhirConverter.js`, `frenchTerminologyAdapter.js`
   - À éviter: `HL7ToFHIRConverter.js`, `FrenchTerminologyAdapter.js`

2. Les noms des classes devraient être en PascalCase
   - Bon: `class PatientConverter {}`
   - À éviter: `class patientConverter {}`

3. Utilisez des noms descriptifs plutôt que des abréviations
   - Bon: `healthcareEncounterBuilder.js`
   - À éviter: `hceb.js`

## Bonnes pratiques pour la gestion des dépendances

1. Gérez les dépendances via `package.json` plutôt que par installation manuelle 
2. Évitez les installations globales de packages spécifiques au projet
3. Documentez clairement les dépendances externes et leur rôle dans le projet

## Déploiement

Si vous utilisez Docker, la commande suivante suffit :

```bash
bash deploy-simple.sh
```

Si vous souhaitez une installation locale :

```bash
npm install
npm install hl7 simple-hl7 hl7-standard hl7-parser --save
node app.js
```

## Migration vers cette structure

Pour faciliter la migration vers cette structure :

1. Créez les répertoires manquants
2. Vérifiez que tous les imports pointent vers les bons fichiers 
3. Utilisez des adaptateurs pour maintenir la compatibilité si nécessaire