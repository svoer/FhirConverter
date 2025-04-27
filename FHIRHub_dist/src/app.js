/**
 * Application principale FHIRHub
 * Service de conversion de HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies et systèmes français de santé
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { initialize } = require('./init');

// Initialiser l'application
const initResult = initialize();

if (!initResult.success) {
  console.error('Erreur critique lors de l\'initialisation. Arrêt de l\'application.');
  process.exit(1);
}

// Créer l'application Express
const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ limit: '10mb', type: 'text/plain' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Routes statiques pour le frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware de journalisation des requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes API
const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const { router: apiKeyRoutes, apiKeyAuth } = require('./routes/apiKeyRoutes');

// Monter les routes d'authentification et d'administration
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/keys', apiKeyRoutes);

// Route de conversion avec authentification par clé API
// Importation directe du convertisseur HL7 vers FHIR
const hl7ToFhirConverter = require('../hl7ToFhirConverter');
const { adaptFhirBundle } = require('../french_terminology_adapter');
const { cleanBundle } = require('../fhir_cleaner');
const { createConversionLog, saveConversionContent } = require('./services/conversionLogService');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configuration du stockage des fichiers téléchargés
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../data/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const upload = multer({ storage: storage });

// Route pour vérifier l'état du service
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Route pour convertir du contenu HL7 en FHIR
app.post('/api/convert', apiKeyAuth, async (req, res) => {
  try {
    const hl7Content = req.body;
    
    if (!hl7Content || typeof hl7Content !== 'string' || hl7Content.trim() === '') {
      return res.status(400).json({ error: 'Contenu HL7 vide ou invalide' });
    }
    
    console.log(`Conversion demandée (${hl7Content.length} octets)`);
    
    // Identifiant unique pour cette conversion
    const conversionId = uuidv4();
    
    try {
      // Convertir HL7 vers FHIR
      let fhirBundle = hl7ToFhirConverter.convertToFhir(hl7Content);
      
      // Adapter les terminologies françaises
      fhirBundle = adaptFhirBundle(fhirBundle);
      
      // Nettoyer les ressources FHIR
      fhirBundle = cleanBundle(fhirBundle);
      
      // Compter les ressources
      const resourceCount = fhirBundle.entry ? fhirBundle.entry.length : 0;
      
      // Journaliser la conversion
      const conversion = createConversionLog({
        app_id: req.application.id,
        api_key_id: req.apiKey.id,
        source_type: 'api',
        source_name: 'direct_input',
        source_size: hl7Content.length,
        resource_count: resourceCount,
        status: 'success',
        conversion_id: conversionId
      });
      
      // Sauvegarder le contenu pour référence future
      saveConversionContent(conversionId, hl7Content, fhirBundle);
      
      // Renvoyer le résultat
      res.json({
        conversionId,
        resourceCount,
        result: fhirBundle
      });
    } catch (error) {
      console.error('Erreur lors de la conversion:', error);
      
      // Journaliser l'erreur
      createConversionLog({
        app_id: req.application.id,
        api_key_id: req.apiKey.id,
        source_type: 'api',
        source_name: 'direct_input',
        source_size: hl7Content.length,
        resource_count: 0,
        status: 'error',
        error_message: error.message,
        conversion_id: conversionId
      });
      
      // Sauvegarder quand même le contenu source pour analyse
      saveConversionContent(conversionId, hl7Content, { error: error.message });
      
      return res.status(400).json({
        error: 'Erreur lors de la conversion',
        message: error.message,
        conversionId // pour référence future
      });
    }
  } catch (error) {
    console.error('Erreur de serveur lors de la conversion:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route pour télécharger et convertir un fichier HL7
app.post('/api/upload', apiKeyAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    // Lire le contenu du fichier
    const hl7Content = fs.readFileSync(file.path, 'utf8');
    
    console.log(`Fichier reçu: ${file.originalname} (${file.size} octets)`);
    
    // Identifiant unique pour cette conversion
    const conversionId = uuidv4();
    
    try {
      // Convertir HL7 vers FHIR
      let fhirBundle = hl7ToFhirConverter.convertToFhir(hl7Content);
      
      // Adapter les terminologies françaises
      fhirBundle = adaptFhirBundle(fhirBundle);
      
      // Nettoyer les ressources FHIR
      fhirBundle = cleanBundle(fhirBundle);
      
      // Compter les ressources
      const resourceCount = fhirBundle.entry ? fhirBundle.entry.length : 0;
      
      // Journaliser la conversion
      const conversion = createConversionLog({
        app_id: req.application.id,
        api_key_id: req.apiKey.id,
        source_type: 'file',
        source_name: file.originalname,
        source_size: file.size,
        resource_count: resourceCount,
        status: 'success',
        conversion_id: conversionId
      });
      
      // Sauvegarder le contenu pour référence future
      saveConversionContent(conversionId, hl7Content, fhirBundle);
      
      // Nettoyer le fichier téléchargé
      fs.unlinkSync(file.path);
      
      // Renvoyer le résultat
      res.json({
        conversionId,
        fileName: file.originalname,
        fileSize: file.size,
        resourceCount,
        result: fhirBundle
      });
    } catch (error) {
      console.error('Erreur lors de la conversion du fichier:', error);
      
      // Journaliser l'erreur
      createConversionLog({
        app_id: req.application.id,
        api_key_id: req.apiKey.id,
        source_type: 'file',
        source_name: file.originalname,
        source_size: file.size,
        resource_count: 0,
        status: 'error',
        error_message: error.message,
        conversion_id: conversionId
      });
      
      // Sauvegarder quand même le contenu source pour analyse
      saveConversionContent(conversionId, hl7Content, { error: error.message });
      
      // Nettoyer le fichier téléchargé
      fs.unlinkSync(file.path);
      
      return res.status(400).json({
        error: 'Erreur lors de la conversion du fichier',
        message: error.message,
        conversionId // pour référence future
      });
    }
  } catch (error) {
    console.error('Erreur de serveur lors du traitement du fichier:', error);
    
    // Nettoyer le fichier téléchargé si possible
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Route pour obtenir les statistiques de conversion
app.get('/api/stats', apiKeyAuth, (req, res) => {
  try {
    const { getConversionStats } = require('./services/conversionLogService');
    
    const options = {
      app_id: req.application.id,
      startDate: req.query.start_date,
      endDate: req.query.end_date
    };
    
    const stats = getConversionStats(options);
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Pour toutes les autres routes, renvoyer l'application React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Exporter l'application
module.exports = app;