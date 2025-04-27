/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const api = require('./api');
const frenchTerminologyService = require('./french_terminology_service');
const { initialize } = require('./src/init');

// Initialiser FHIRHub
const initResult = initialize();
if (!initResult.success) {
  console.error('Erreur critique lors de l\'initialisation:', initResult.error);
  process.exit(1);
}

// Création de l'application Express
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ type: 'text/plain', limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Routes API principales
app.use('/api', api);

// Routes API d'authentification et d'administration
const authRoutes = require('./src/routes/authRoutes');
const applicationRoutes = require('./src/routes/applicationRoutes');
const apiKeyRoutes = require('./src/routes/apiKeyRoutes');
const statsRoutes = require('./src/routes/statsRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/stats', statsRoutes);

// La page d'accueil est servie automatiquement depuis le répertoire frontend/public

// Démarrer le serveur
app.listen(port, '0.0.0.0', () => {
  console.log('Serveur FHIRHub démarré sur le port ' + port);
  
  // Créer les répertoires nécessaires
  const dataDir = path.join(__dirname, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const conversionsDir = path.join(dataDir, 'conversions');
  
  [dataDir, uploadsDir, conversionsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log("Service FHIRHub prêt pour les conversions via API.");
});

// Gérer l'arrêt gracieux
process.on('SIGINT', () => {
  console.log('Arrêt du serveur FHIRHub...');
  process.exit(0);
});