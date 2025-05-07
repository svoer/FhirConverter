# Middlewares d'Authentification FHIRHub

Ce document décrit les middlewares d'authentification standardisés disponibles dans l'application FHIRHub et comment les utiliser correctement.

## Middlewares disponibles

### 1. `authCombined.checkAuth`

Ce middleware vérifie l'authentification soit par token JWT, soit par clé API. Utilisez-le lorsque vous souhaitez permettre les deux méthodes d'authentification.

```javascript
const authCombined = require('../middleware/authCombined');

router.get('/ma-route', authCombined.checkAuth, (req, res) => {
  // La route est protégée et req.user ou req.apiKeyData sera disponible
});
```

### 2. `authCombined.requireAdmin`

Ce middleware vérifie que l'utilisateur est authentifié par JWT et qu'il a le rôle d'administrateur.

```javascript
const authCombined = require('../middleware/authCombined');

router.get('/ma-route-admin', authCombined.requireAdmin, (req, res) => {
  // La route est protégée et uniquement accessible aux administrateurs
});
```

### 3. `authCombined.authWithRoles(options)`

Ce middleware configurable permet de vérifier l'authentification par JWT avec des contraintes de rôles spécifiques.

```javascript
const authCombined = require('../middleware/authCombined');

// Exemple avec restriction aux administrateurs
router.get('/admin-only', authCombined.authWithRoles({ roles: ['admin'] }), (req, res) => {
  // La route est protégée et uniquement accessible aux administrateurs
});

// Exemple avec restriction aux administrateurs et utilisateurs standards
router.get('/user-or-admin', authCombined.authWithRoles({ roles: ['admin', 'user'] }), (req, res) => {
  // La route est accessible aux utilisateurs standard et aux administrateurs
});
```

### 4. `jwtAuth.verifyToken`

Ce middleware vérifie uniquement l'authentification par token JWT.

```javascript
const jwtAuth = require('../middleware/jwtAuth');

router.get('/jwt-only', jwtAuth.verifyToken, (req, res) => {
  // La route est protégée et req.user sera disponible
});
```

### 5. `apiKeyAuth.verifyApiKey`

Ce middleware vérifie uniquement l'authentification par clé API.

```javascript
const apiKeyAuth = require('../middleware/apiKeyAuth');

router.get('/api-key-only', apiKeyAuth.verifyApiKey, (req, res) => {
  // La route est protégée et req.apiKeyData sera disponible
});
```

## Accéder aux informations d'authentification

Dans vos gestionnaires de routes, vous pouvez accéder aux informations suivantes :

- `req.user` : Objet contenant les informations de l'utilisateur authentifié par JWT
- `req.apiKeyData` : Objet contenant les informations de la clé API utilisée

## Bonnes pratiques

1. **Utilisez toujours `authCombined` plutôt que d'enchaîner manuellement les middlewares** - C'est plus lisible et plus maintainable.

2. **Utilisez `authWithRoles` pour les restrictions basées sur les rôles** - C'est plus clair et plus consistant que de vérifier manuellement les rôles dans le handler.

3. **Pensez à inclure la vérification d'authentification dans la documentation Swagger** - Utilisez les sections `security` pour indiquer quel type d'authentification est requis.

4. **Évitez de mélanger différents patterns d'authentification** - Standardisez l'approche pour maintenir la cohérence du code.