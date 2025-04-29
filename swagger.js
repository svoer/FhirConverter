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
  apis: ['./app.js', './routes/*.js', './api/*.js'] // Fichiers contenant les annotations Swagger
};

// Initialisation du générateur de spécification Swagger
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Fonction d'initialisation de Swagger pour l'application Express
function setupSwagger(app) {
  // Interface Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'FHIRHub API Documentation',
    customfavIcon: '/favicon.ico'
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