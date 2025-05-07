# Système d'Authentification FHIRHub

Ce document décrit les systèmes d'authentification utilisés dans l'application FHIRHub.

## Types d'Authentification

FHIRHub prend en charge deux types d'authentification :

1. **Authentification par token JWT** - Pour les utilisateurs connectés via l'interface web
2. **Authentification par clé API** - Pour les intégrations système et les accès programmés

## Middleware d'Authentification

Le système utilise trois modules principaux pour gérer l'authentification :

1. **jwtAuth.js** - Authentification basée sur JWT (JSON Web Token)
2. **apiKeyAuth.js** - Authentification par clé API
3. **authCombined.js** - Module combinant les deux types d'authentification

### Middlewares Disponibles

#### `authCombined.checkAuth`
- Vérifie la présence d'un token JWT ou d'une clé API
- Priorité au token JWT si les deux sont présents
- Utilisation : `router.get('/route', authCombined.checkAuth, ...)`

#### `authCombined.requireAdmin` 
- Vérifie que l'utilisateur est authentifié et a le rôle d'administrateur
- Utilisation : `router.get('/route', authCombined.requireAdmin, ...)`

#### `authCombined.authWithRoles`
- Middleware configurable pour vérification de rôles
- Utilisation : `router.get('/route', authCombined.authWithRoles({ roles: ['admin', 'user'] }), ...)`

#### `jwtAuth.verifyToken`
- Vérifie uniquement la présence d'un token JWT valide
- Utilisation : `router.get('/route', jwtAuth.verifyToken, ...)`

#### `apiKeyAuth.verifyApiKey`
- Vérifie uniquement la présence d'une clé API valide
- Utilisation : `router.get('/route', apiKeyAuth.verifyApiKey, ...)`

## Bonnes Pratiques d'Authentification

1. Pour protéger une route avec les deux types d'authentification, utilisez `authCombined.checkAuth`
2. Pour les routes administratives, utilisez `authCombined.requireAdmin` ou `authCombined.authWithRoles({ roles: ['admin'] })`
3. Pour les routes nécessitant un rôle spécifique, utilisez `authCombined.authWithRoles` avec les rôles appropriés
4. Vérifiez toujours le rôle ou les permissions de l'utilisateur avant de permettre des opérations sensibles

## Informations d'Utilisateur

Après l'authentification, les informations suivantes sont disponibles dans les objets de requête :

### Avec JWT
- `req.user` : Contient l'objet utilisateur complet avec ses attributs (id, username, role, etc.)

### Avec Clé API
- `req.apiKey` : Contient les détails de la clé API utilisée
- `req.app` : Contient les informations de l'application liée à la clé API

## Configuration

Les clés de configuration sont dans le fichier `.env` :

- `JWT_SECRET` : Clé secrète pour signer les tokens JWT
- `TOKEN_EXPIRATION` : Durée de validité des tokens JWT (défaut: 24h)

## Sécurité et Recommandations

1. Les tokens JWT expirent automatiquement après la durée spécifiée
2. Les mots de passe sont hachés avant stockage en base de données
3. Les clés API sont stockées avec un hachage SHA-256
4. En production, utilisez toujours HTTPS pour sécuriser les échanges
5. Limitez les permissions de chaque clé API au strict nécessaire