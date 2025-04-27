/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R5
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const api = require('./api');
const fileMonitor = require('./fileMonitor');
const frenchTerminologyService = require('./french_terminology_service');

// Création de l'application Express
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Routes API
app.use('/api', api);

// La page d'accueil est servie automatiquement depuis le répertoire frontend/public

// Démarrer le serveur
app.listen(port, '0.0.0.0', () => {
  console.log('Serveur FHIRHub démarré sur le port ' + port);
  
  // Créer les répertoires nécessaires
  const dataDir = path.join(__dirname, 'data');
  const inDir = path.join(dataDir, 'in');
  const outDir = path.join(dataDir, 'out');
  const uploadsDir = path.join(dataDir, 'uploads');
  
  [dataDir, inDir, outDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // La surveillance automatique des fichiers a été désactivée
  console.log("Mode API uniquement: la surveillance automatique des fichiers est désactivée.");
});

// Gérer l'arrêt gracieux
process.on('SIGINT', () => {
  console.log('Arrêt du serveur FHIRHub...');
  process.exit(0);
});