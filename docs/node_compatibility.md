# Compatibilité Node.js pour FHIRHub

FHIRHub est conçu pour fonctionner de façon optimale avec les versions LTS (Long Term Support) de Node.js, en particulier les versions 18.x et 20.x.

## Versions recommandées

- **Node.js 18.x LTS** (Hydrogen)
- **Node.js 20.x LTS** (Iron)

Ces versions offrent la meilleure compatibilité avec les dépendances du projet, notamment les modules natifs comme `better-sqlite3`.

## Problèmes connus avec Node.js 22+

Certaines dépendances peuvent présenter des problèmes de compatibilité avec les versions récentes de Node.js (22+). Ces problèmes incluent mais ne sont pas limités à :

1. **Modules natifs** : Les modules qui nécessitent une compilation comme `better-sqlite3` peuvent échouer pendant l'installation en raison de changements dans l'API C++ de Node.js v22.

2. **Erreurs spécifiques** :
   - Problèmes avec les fonctions `v8::ObjectTemplate::SetAccessor`
   - Incompatibilités avec les nouvelles versions de V8
   - Différences de gestion de la mémoire

## Solutions pour Node.js 22+

Si vous devez absolument utiliser Node.js 22+ et rencontrez des problèmes :

1. **Créer un environnement isolé** : Utilisez nvm (Node Version Manager) pour installer et utiliser une version spécifique de Node.js pour FHIRHub :
   ```bash
   # Installation de nvm (si non installé)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   
   # Installation de Node.js 20.x LTS
   nvm install 20
   
   # Utilisation de Node.js 20.x pour l'installation et l'exécution
   nvm use 20
   npm install
   ```

2. **Utiliser Docker** : Le conteneur Docker de FHIRHub utilise Node.js 20-alpine, ce qui garantit une compatibilité optimale sans se soucier de la version installée sur votre système.

3. **Forcer les versions des dépendances** : Si nécessaire, vous pouvez essayer d'installer des versions spécifiques des dépendances problématiques :
   ```bash
   npm install better-sqlite3@8.5.0 --build-from-source
   ```

## Vérification de la version

Pour vérifier votre version de Node.js :

```bash
node -v
```

## Notes pour les développeurs

Si vous contribuez au projet FHIRHub, assurez-vous de développer et tester avec Node.js 20.x LTS pour garantir la compatibilité avec la majorité des déploiements. Évitez d'utiliser des fonctionnalités spécifiques à Node.js 22+ qui pourraient rendre le code incompatible avec les versions antérieures.