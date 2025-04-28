/**
 * Point d'entrée principal pour l'application FHIRHub
 * Convertisseur HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies françaises
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import path from 'path';
import * as dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Routes
import convertRoutes from './api/routes/convertRoutes';
import apiKeyRoutes from './api/routes/apiKeyRoutes'; 
import applicationRoutes from './api/routes/applicationRoutes';

// Services
import { initDatabase } from './api/db/database';

// Charger les variables d'environnement
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Options de documentation Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API FHIRHub',
      version: '1.0.0',
      description: 'API de conversion HL7 v2.5 vers FHIR R4',
      contact: {
        name: 'Support FHIRHub',
        email: 'support@fhirhub.fr'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Serveur principal'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-KEY'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: ['./src/api/routes/*.ts']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Routes API
app.use('/api/v1/convert', convertRoutes);
app.use('/api/v1/apikeys', apiKeyRoutes);
app.use('/api/v1/applications', applicationRoutes);

// Documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route par défaut pour l'interface utilisateur
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/login.html'));
});

// Routes temporaires pour la migration
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalConversions: 0,
      successRate: 100,
      averageProcessingTime: 0
    }
  });
});

app.get('/api/conversions', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'FHIRHub fonctionne correctement',
    version: '1.0.0'
  });
});

// Gestionnaire d'erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'La ressource demandée n\'existe pas'
  });
});

// Initialisation et démarrage du serveur
async function startServer() {
  // Initialiser la base de données
  initDatabase();
  
  // Démarrer le serveur
  app.listen(port, () => {
    console.log(`[SERVER] FHIRHub démarré sur le port ${port}`);
    console.log(`[SERVER] Documentation API disponible sur http://localhost:${port}/api-docs`);
  });
}

// Démarrer l'application
startServer().catch(error => {
  console.error('[SERVER] Erreur lors du démarrage:', error);
  process.exit(1);
});