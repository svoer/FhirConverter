# FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

![Logo FHIRHub](./public/img/flame-icon.svg)

> Le futur du partage de données santé, dès aujourd'hui. Modernisez votre interop, sans refonte, sans complexité. FHIRHub – L'upgrade FHIR, aussi simple qu'un glisser-déposer.

## Présentation

FHIRHub est une application robuste dédiée à la conversion des messages HL7 v2.5 vers le format FHIR R4, spécialement adaptée aux spécifications françaises de l'ANS (Agence du Numérique en Santé). Conçue comme une solution portable et déployable sans dépendances lourdes, elle offre :

- Une API REST sécurisée avec authentification par clé API
- Une base de données SQLite intégrée pour la persistance et les logs
- Une interface utilisateur React moderne avec un design "e-Santé" (dégradé rouge-orange)
- Une prise en charge complète des terminologies françaises et des OIDs spécifiques
- Un modèle d'applications multiples permettant de gérer différents flux d'intégration

## Fonctionnalités clés

- Conversion en temps réel de messages HL7 v2.5 vers FHIR R4
- Validation et analyse des messages HL7
- Gestion d'applications et de clés API multiples
- Terminologies françaises préchargées (fonctionnement hors-ligne)
- Interface de conversion avec prévisualisation et logs en temps réel
- Documentation API complète avec Swagger

## Prérequis

- Node.js v18+ (recommandé : v20)
- npm ou yarn

## Installation

### Installation standard

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/votre-organisation/fhirhub.git
   cd fhirhub
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Lancement direct :
   ```bash
   npm start
   # ou
   bash start.sh
   ```

4. Naviguez vers `http://localhost:5000` pour accéder à l'interface.

### Installation avec PM2 (pour production)

1. Installez PM2 globalement si ce n'est pas déjà fait :
   ```bash
   npm install -g pm2
   ```

2. Lancez l'application avec PM2 :
   ```bash
   pm2 start start.sh --name "fhirhub"
   pm2 save
   ```

3. Pour configurer le démarrage automatique au redémarrage du serveur :
   ```bash
   pm2 startup
   ```

### Installation avec Docker

1. Construisez l'image Docker :
   ```bash
   docker build -t fhirhub .
   ```

2. Lancez le conteneur :
   ```bash
   docker run -d -p 5000:5000 --name fhirhub fhirhub
   ```

## Configuration

Les paramètres par défaut sont adaptés à la plupart des cas d'utilisation, mais vous pouvez personnaliser l'application via les variables d'environnement suivantes (dans un fichier `.env`) :

```
PORT=5000                    # Port d'écoute du serveur
DB_PATH=./data/fhirhub.db    # Chemin de la base de données SQLite
LOG_LEVEL=info               # Niveau de journalisation (debug, info, warn, error)
JWT_SECRET=votre_secret_jwt  # Clé secrète pour les JWT (à modifier en production)
```

## Utilisation

1. Connectez-vous avec les identifiants par défaut :
   - Username : `admin`
   - Password : `adminfhirhub`

2. Créez une application et générez des clés API dans la section "Applications".

3. Utilisez l'interface de conversion ou l'API REST pour convertir des messages HL7 v2.5 en FHIR R4.

### Clés API pour le développement

Pour faciliter les tests, utilisez la clé API de développement `dev-key`.

## Architecture

- **Frontend** : Interface React moderne avec CSS personnalisé
- **Backend** : Node.js avec Express
- **Stockage** : SQLite pour la persistance et les logs
- **Authentification** : JWT pour les utilisateurs + clés API pour les applications
- **Documentation API** : Swagger UI intégré

## Scripts importants

- `start.sh` : Script principal de démarrage
- `npm start` : Lance l'application
- `npm run db:init` : Initialise la base de données

## Maintenance

### Backups

Les données sont stockées dans le répertoire `./data/`. Pour effectuer une sauvegarde :

```bash
# Sauvegarde de la base de données
cp ./data/fhirhub.db ./backups/fhirhub_$(date +%Y%m%d).db

# Archive complète de l'application
tar -czvf ./backups/fhirhub_full_$(date +%Y%m%d).tar.gz --exclude="node_modules" ./
```

### Logs

Les logs système sont accessibles via :

```bash
tail -f ./logs/fhirhub.log
```

## Sécurité

- Changez les identifiants administrateur par défaut dès la première utilisation
- Utilisez un `JWT_SECRET` fort en production
- Limitez l'accès au serveur via un pare-feu
- Configurez HTTPS en production

## Contributeurs

- Équipe FHIRHub

## Licence

Tous droits réservés.