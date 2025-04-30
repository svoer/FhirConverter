/**
 * Configuration Swagger pour l'API FHIRHub
 */
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Définition des options Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FHIRHub API',
      version: '1.0.0',
      description: 'API pour le convertisseur HL7 v2.5 vers FHIR R4 avec support des terminologies françaises',
      contact: {
        name: 'Équipe FHIRHub',
        email: 'support@fhirhub.fr'
      },
      license: {
        name: 'Licence FHIRHub',
        url: 'https://www.fhirhub.fr/licence'
      }
    },
    servers: [
      {
        url: '/',
        description: 'Serveur FHIRHub'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY',
          description: 'Clé API pour l\'authentification'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT pour l\'authentification (utilisateurs connectés)'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      },
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./app.js', './routes/*.js', './api/*.js', './src/**/*.js'] // Fichiers contenant les annotations Swagger
};

// Initialisation du générateur de spécification Swagger
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Fonction d'initialisation de Swagger pour l'application Express
function setupSwagger(app) {
  // Middleware pour permettre à l'admin d'accéder à Swagger sans authentification supplémentaire
  const swaggerAuthMiddleware = (req, res, next) => {
    // Vérifier si l'utilisateur est authentifié avec un JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        // Utiliser la même clé secrète que dans jwtAuth.js
        const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Vérifier si l'utilisateur est admin dans la base de données
        const db = req.app.locals.db;
        const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(decoded.id);
        
        if (user && user.role === 'admin') {
          // Pour les administrateurs, ajouter une clé API de développement aux en-têtes
          const devKey = db.prepare(`SELECT key FROM api_keys WHERE key = 'dev-key' LIMIT 1`).get();
          if (devKey) {
            // Ajouter la clé API aux en-têtes pour les requêtes Swagger
            req.headers['x-api-key'] = devKey.key;
          }
        }
      } catch (error) {
        console.error('[SWAGGER AUTH]', error);
      }
    }
    next();
  };

  // Appliquer le middleware d'authentification pour Swagger
  app.use('/api-docs', swaggerAuthMiddleware);
  
  // Interface Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'FHIRHub API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: '/js/swagger-helper.js',
    swaggerOptions: {
      persistAuthorization: true
    }
  }));

  // Route pour télécharger le fichier JSON Swagger
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('[SWAGGER] Documentation API disponible sur /api-docs');
}

module.exports = {
  setupSwagger
};