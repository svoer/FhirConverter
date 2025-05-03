/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
// const mainRouter = require('./src/routes/mainRouter');
const tmpRouter = require('./src/routes/tmpRouter');
const adminRoutes = require('./routes/adminRoutes');
const dbService = require('./src/services/dbService');
const terminologyService = require('./src/services/terminologyService');
const aiProviderService = require('./src/services/aiProviderService');
const dbMaintenanceService = require('./src/services/dbMaintenanceService');
const loggerService = require('./src/services/loggerService');

// Configuration de l'environnement
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Middleware pour ajouter des informations sur la requête pour le débogage
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Router principal
app.use('/api', tmpRouter);

// Router d'administration
app.use('/api/admin', adminRoutes);

// Middleware de gestion des erreurs
app.use(async (err, req, res, next) => {
  console.error('[ERROR] Erreur du serveur:', err);
  
  try {
    // Journaliser l'erreur
    await loggerService.logSystemEvent(
      'server_error',
      `Erreur du serveur: ${err.message}`,
      {
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        user_id: req.user ? req.user.id : null
      },
      'ERROR',
      req.user ? req.user.id : null,
      req.ip
    );
  } catch (logError) {
    console.error('[ERROR] Erreur lors de la journalisation de l\'erreur du serveur:', logError);
  }
  
  // Envoyer une réponse d'erreur au client
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur interne est survenue',
    request_id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5) // Identifiant unique pour faciliter le suivi
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    console.log('==========================================================');
    console.log('   FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4');
    console.log('   Version 1.2.0 - Compatible ANS');
    console.log(`   ${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString()}`);
    console.log('==========================================================');
    
    // Initialisation des services
    await dbService.initialize();
    console.log('[SERVER] Base de données initialisée avec succès');
    
    // Vérification initiale de l'intégrité de la base de données
    try {
      console.log('[SERVER] Vérification initiale de l\'intégrité de la base de données...');
      const dbCheckResult = await dbMaintenanceService.checkDatabaseIntegrity();
      
      if (dbCheckResult.status === 'repaired') {
        console.log('[SERVER] Base de données réparée avec succès:', dbCheckResult.tablesCreated);
      } else if (dbCheckResult.status === 'error') {
        console.error('[SERVER] Erreurs lors de la vérification de la base de données:', dbCheckResult.errors);
      } else {
        console.log('[SERVER] Vérification de la base de données terminée sans problème');
      }
      
      // Démarrer la maintenance périodique de la base de données
      // Vérifier toutes les 6 heures (360 minutes)
      const stopDbMaintenance = dbMaintenanceService.startPeriodicMaintenance(360);
      
      // Démarrer le nettoyage automatique des logs
      // Nettoyer tous les 7 jours et conserver 60 jours de logs
      console.log('[SERVER] Démarrage du nettoyage automatique des logs...');
      const stopLogCleanup = loggerService.startAutomaticCleanup(7, 60);
      
      // Journaliser le démarrage du serveur
      await loggerService.logSystemEvent(
        'server_start',
        'Démarrage du serveur FHIRHub',
        {
          version: '1.2.0',
          port: PORT,
          environment: process.env.NODE_ENV
        }
      );
      
      // Permettre l'arrêt propre des services lors de l'arrêt du serveur
      process.on('SIGINT', async () => {
        console.log('[SERVER] Arrêt des services...');
        stopDbMaintenance();
        stopLogCleanup();
        
        // Journaliser l'arrêt du serveur
        await loggerService.logSystemEvent(
          'server_stop',
          'Arrêt du serveur FHIRHub',
          { reason: 'SIGINT' }
        );
        
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('[SERVER] Arrêt des services...');
        stopDbMaintenance();
        stopLogCleanup();
        
        // Journaliser l'arrêt du serveur
        await loggerService.logSystemEvent(
          'server_stop',
          'Arrêt du serveur FHIRHub',
          { reason: 'SIGTERM' }
        );
        
        process.exit(0);
      });
    } catch (dbCheckError) {
      console.error('[SERVER] Erreur lors de la vérification initiale de la base de données:', dbCheckError);
      // Continuer malgré l'erreur
    }
    
    // Initialiser les autres services
    await terminologyService.initialize();
    console.log('[SERVER] Service de terminologie initialisé avec succès');
    
    await aiProviderService.initialize();
    console.log('[SERVER] Service d\'IA initialisé avec succès');
    
    // Démarrage du serveur
    app.listen(PORT, '0.0.0.0', () => {
      console.log('[SERVER] FHIRHub démarré sur le port ' + PORT + ' (0.0.0.0)');
      console.log('[SERVER] Accessible sur http://localhost:' + PORT + ' et http://<ip-serveur>:' + PORT);
    });
  } catch (error) {
    console.error('[SERVER] Erreur critique lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('uncaughtException', async (err) => {
  console.error('[ERROR] Erreur non capturée:', err);
  
  try {
    // Journaliser l'erreur
    await loggerService.logSystemEvent(
      'uncaught_exception',
      `Erreur non capturée: ${err.message}`,
      {
        stack: err.stack,
        name: err.name
      },
      'ERROR'
    );
  } catch (logError) {
    console.error('[ERROR] Erreur lors de la journalisation de l\'erreur non capturée:', logError);
  }
  
  // Dans un environnement de production, on pourrait redémarrer le serveur
  if (process.env.NODE_ENV === 'production') {
    console.error('[ERROR] Erreur critique, arrêt du serveur...');
    process.exit(1);
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[ERROR] Promesse rejetée non gérée:', reason);
  
  try {
    // Journaliser l'erreur
    await loggerService.logSystemEvent(
      'unhandled_rejection',
      `Promesse rejetée non gérée: ${reason instanceof Error ? reason.message : String(reason)}`,
      {
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise)
      },
      'ERROR'
    );
  } catch (logError) {
    console.error('[ERROR] Erreur lors de la journalisation de la promesse rejetée:', logError);
  }
});

// Démarrage de l'application
startServer();