/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const apiRouter = require('./src/routes/apiRouter');
const dbService = require('./src/services/dbService');
const terminologyService = require('./src/services/terminologyService');

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Router API
app.use('/api', apiRouter);

// Route principale pour le frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

// Route pour la page de documentation
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/docs.html'));
});

// Démarrage du serveur
async function startServer() {
  try {
    // Initialisation des services
    await dbService.initialize();
    await terminologyService.initialize();
    
    // Démarrage du serveur
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Serveur FHIRHub démarré sur le port ${PORT}`);
      console.log(`API accessible à l'adresse http://localhost:${PORT}/api`);
      console.log(`Interface web accessible à l'adresse http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('Erreur non capturée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
});

// Démarrage de l'application
startServer();