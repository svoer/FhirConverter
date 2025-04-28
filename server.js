/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Services
const dbService = require('./src/services/dbService');
const terminologyService = require('./src/services/terminologyService');

// Routeurs
const apiRouter = require('./src/routes/apiRouter');

// Création de l'application Express
const app = express();

// Configuration de base
const PORT = process.env.PORT || 5000;
const VERSION = '1.0.0';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ limit: '10mb', type: 'text/plain' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Initialisation de la base de données
dbService.initialize()
  .then(() => {
    console.log('[DB] Base de données initialisée avec succès');
    
    // Initialiser le service de terminologie
    terminologyService.initialize()
      .then(() => {
        console.log('[TERMINOLOGY] Service de terminologie initialisé');
      })
      .catch(err => {
        console.error('[TERMINOLOGY] Erreur lors de l\'initialisation du service de terminologie:', err);
      });
  })
  .catch(err => {
    console.error('[DB] Erreur lors de l\'initialisation de la base de données:', err);
  });

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Monter le routeur API
app.use('/api', apiRouter);

// Route principale pour servir l'interface utilisateur
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

// Route 404 pour toutes les autres routes
app.use((req, res) => {
  // Si c'est une route d'API, renvoyer une erreur JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Non trouvé',
      message: `Route API non trouvée: ${req.path}`
    });
  }
  
  // Sinon, rediriger vers la page d'accueil
  res.redirect('/');
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  // Si c'est une route d'API, renvoyer une erreur JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: err.message
    });
  }
  
  // Sinon, afficher une page d'erreur
  res.status(500).send('Erreur serveur');
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur FHIRHub démarré sur le port ${PORT}`);
  console.log(`API accessible à l'adresse http://localhost:${PORT}/api`);
  console.log(`Interface web accessible à l'adresse http://localhost:${PORT}`);
});

// Gestion de l'arrêt propre du serveur
process.on('SIGINT', () => {
  console.log('\nArrêt du serveur FHIRHub...');
  
  // Fermer proprement la connexion à la base de données
  dbService.close()
    .then(() => {
      console.log('Fermeture propre de la base de données');
      process.exit(0);
    })
    .catch(err => {
      console.error('Erreur lors de la fermeture de la base de données:', err);
      process.exit(1);
    });
});