/**
 * Serveur principal FHIRHub
 * Ce serveur expose une API REST pour la conversion HL7 vers FHIR
 * et sert l'interface web
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Modules internes
const converter = require('./src/converters/hl7ToFhirConverter');
const frenchTerminologyAdapter = require('./french_terminology_adapter');
const fhirCleaner = require('./fhir_cleaner');
const dbService = require('./src/db/dbService');

// Créer les répertoires nécessaires s'ils n'existent pas
const requiredDirs = [
  'data', 
  'data/uploads', 
  'data/conversions', 
  'data/in', 
  'data/out',
  'french_terminology/cache'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Création du répertoire ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Configuration du middleware de téléchargement
const upload = multer({ dest: 'data/uploads/' });

// Initialiser l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.text({ limit: '10mb', type: 'text/plain' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Middleware d'enrichissement des résultats API
const { apiResultEnricherMiddleware } = require('./src/utils/apiResultEnricher');
app.use(apiResultEnricherMiddleware);

// Middleware d'authentification par clé API
async function apiKeyAuth(req, res, next) {
  // Pas d'authentification pour ces chemins
  const publicPaths = ['/api/health', '/api/info'];
  if (publicPaths.includes(req.path)) {
    return next();
  }
  
  // Récupérer la clé API
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Clé API manquante', 
      message: 'Veuillez fournir une clé API valide dans l\'en-tête X-API-Key ou le paramètre apiKey'
    });
  }
  
  // Clé de développement spéciale pour les tests
  if (apiKey === 'dev-key') {
    req.appInfo = { 
      id: 1, 
      name: 'Application par défaut', 
      settings: { maxHistoryDays: 30, enableLogging: true } 
    };
    return next();
  }
  
  // Valider la clé API
  const apiKeyInfo = dbService.validateApiKey(apiKey);
  
  if (!apiKeyInfo) {
    return res.status(401).json({ 
      error: 'Clé API invalide', 
      message: 'La clé API fournie n\'est pas valide ou a été désactivée'
    });
  }
  
  // Stocker les informations de l'application dans la requête
  req.appInfo = {
    id: apiKeyInfo.app_id,
    name: apiKeyInfo.app_name,
    settings: apiKeyInfo.settings || {}
  };
  
  next();
}

// Utiliser le middleware d'authentification
app.use('/api', apiKeyAuth);

// Routes API
// Point d'entrée pour vérifier la santé du serveur
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Informations sur le serveur
app.get('/api/info', (req, res) => {
  res.json({
    name: 'FHIRHub',
    description: 'Convertisseur HL7 v2.5 vers FHIR R4',
    version: '1.0.0',
    frenchTerminologies: frenchTerminologyAdapter.getAllTerminologySystems() ? 'loaded' : 'not_loaded'
  });
});

// Récupérer la liste des conversions
app.get('/api/conversions', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 20;
  const appId = req.appInfo && req.appInfo.id ? req.appInfo.id : 1;
  
  const conversions = dbService.getConversionHistory({
    appId,
    limit
  });
  
  res.json(conversions);
});

// Obtenir une conversion spécifique par ID
app.get('/api/conversions/:id', (req, res) => {
  const conversion = dbService.getConversionById(req.params.id);
  
  if (!conversion) {
    return res.status(404).json({ 
      error: 'Conversion non trouvée', 
      message: `Aucune conversion trouvée avec l'ID ${req.params.id}`
    });
  }
  
  // Vérifier que la conversion appartient à l'application actuelle
  if (conversion.app_id && req.appInfo && req.appInfo.id && conversion.app_id !== req.appInfo.id) {
    return res.status(403).json({ 
      error: 'Accès refusé', 
      message: 'Cette conversion appartient à une autre application'
    });
  }
  
  // Préparer le résultat
  let result;
  
  try {
    // Analyser le contenu JSON du résultat s'il existe
    result = conversion.result_content ? JSON.parse(conversion.result_content) : null;
  } catch (error) {
    result = { error: 'Erreur lors du parsing du résultat' };
  }
  
  res.json({
    id: conversion.conversion_id,
    sourceContent: conversion.source_content,
    sourceName: conversion.source_name,
    status: conversion.status,
    message: conversion.message,
    createdAt: conversion.created_at,
    resourceCount: conversion.resource_count,
    result
  });
});

// Statistiques
app.get('/api/stats', (req, res) => {
  const days = req.query.days ? parseInt(req.query.days) : 30;
  const appId = req.appInfo && req.appInfo.id ? req.appInfo.id : 1;
  
  const stats = dbService.getAppStats(appId, days);
  const systemInfo = dbService.getSystemInfo();
  
  res.json({
    appStats: stats,
    systemInfo
  });
});

// Méthode principale pour convertir du contenu HL7 en FHIR
async function convertHL7ToFHIR(hl7Content, options = {}) {
  try {
    // Vérifier que le contenu HL7 est valide
    if (!hl7Content || typeof hl7Content !== 'string' || hl7Content.trim().length < 10) {
      throw new Error('Contenu HL7 invalide ou trop court');
    }
    
    // Options par défaut
    const defaultOptions = {
      cleanResult: true,
      adaptFrenchTerminologies: true,
      outputFormat: 'json'
    };
    
    // Fusionner les options
    const finalOptions = { ...defaultOptions, ...options };
    
    // Convertir le message HL7 en FHIR
    let conversionResult = await converter.convert(hl7Content, finalOptions);
    
    // Adapter pour les terminologies françaises si demandé
    if (finalOptions.adaptFrenchTerminologies) {
      conversionResult.fhir = frenchTerminologyAdapter.adaptFhirBundle(conversionResult.fhir);
    }
    
    // Nettoyer le résultat si demandé
    if (finalOptions.cleanResult && conversionResult.fhir) {
      conversionResult.fhir = fhirCleaner.cleanBundle(conversionResult.fhir);
    }
    
    // Préparer la réponse
    const result = {
      status: 'success',
      message: 'Conversion réussie',
      fhir: conversionResult.fhir,
      resourceCount: conversionResult.fhir && conversionResult.fhir.entry ? conversionResult.fhir.entry.length : 0,
      fhirResources: conversionResult.fhir && conversionResult.fhir.entry ? 
        conversionResult.fhir.entry.map(e => e.resource) : []
    };
    
    return result;
  } catch (error) {
    console.error('[SERVER] Erreur lors de la conversion:', error);
    
    // Préparer la réponse d'erreur
    return {
      status: 'error',
      message: `Erreur de conversion: ${error.message}`,
      error: error.stack
    };
  }
}

// Point d'entrée pour la conversion de contenu HL7
app.post('/api/convert', async (req, res) => {
  let hl7Content;
  let options = {};
  
  // Déterminer le type de contenu de la requête
  if (req.is('application/json')) {
    if (!req.body) {
      return res.status(400).json({ 
        error: 'Corps de requête invalide', 
        message: 'Le corps de la requête doit être un objet JSON contenant le contenu HL7'
      });
    }
    
    // Si c'est un JSON, extraire le contenu et les options
    hl7Content = req.body.content;
    options = req.body.options || {};
  } else if (req.is('text/plain')) {
    // Si c'est du texte brut, utiliser directement comme contenu HL7
    hl7Content = req.body;
  } else {
    return res.status(415).json({ 
      error: 'Type de contenu non supporté', 
      message: 'Le type de contenu doit être application/json ou text/plain'
    });
  }
  
  if (!hl7Content) {
    return res.status(400).json({ 
      error: 'Contenu HL7 manquant', 
      message: 'Veuillez fournir le contenu HL7 à convertir'
    });
  }
  
  // Convertir le contenu HL7 en FHIR
  const result = await convertHL7ToFHIR(hl7Content, options);
  
  // Enregistrer la conversion dans l'historique
  const conversionId = dbService.saveConversion({
    app_id: req.appInfo && req.appInfo.id ? req.appInfo.id : 1,
    source_name: 'API Direct',
    source_content: hl7Content,
    result_content: JSON.stringify(result),
    status: result.status,
    message: result.message,
    resource_count: result.resourceCount || 0
  });
  
  if (conversionId) {
    result.id = conversionId;
  }
  
  // Envoyer le résultat
  res.json(result);
});

// Point d'entrée pour le téléchargement et la conversion d'un fichier HL7
app.post('/api/upload', upload.single('file'), async (req, res) => {
  // Vérifier qu'un fichier a été téléchargé
  if (!req.file) {
    return res.status(400).json({ 
      error: 'Fichier manquant', 
      message: 'Veuillez télécharger un fichier HL7'
    });
  }
  
  try {
    // Lire le contenu du fichier
    const filePath = req.file.path;
    const hl7Content = fs.readFileSync(filePath, 'utf8');
    
    // Extraire les options de la requête
    const options = req.body.options ? JSON.parse(req.body.options) : {};
    
    // Convertir le contenu HL7 en FHIR
    const result = await convertHL7ToFHIR(hl7Content, options);
    
    // Enregistrer la conversion dans l'historique
    const conversionId = dbService.saveConversion({
      app_id: req.appInfo && req.appInfo.id ? req.appInfo.id : 1,
      source_name: req.file.originalname,
      source_content: hl7Content,
      result_content: JSON.stringify(result),
      status: result.status,
      message: result.message,
      resource_count: result.resourceCount || 0
    });
    
    if (conversionId) {
      result.id = conversionId;
    }
    
    // Nettoyer le fichier temporaire
    fs.unlink(filePath, (err) => {
      if (err) console.error('Erreur lors de la suppression du fichier temporaire:', err);
    });
    
    // Envoyer le résultat
    res.json(result);
  } catch (error) {
    console.error('[SERVER] Erreur lors du traitement du fichier:', error);
    
    res.status(500).json({ 
      error: 'Erreur serveur', 
      message: `Erreur lors du traitement du fichier: ${error.message}`
    });
  }
});

// Récupérer un fichier FHIR généré
app.get('/api/files/fhir/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Vérifier que le nom de fichier est valide
  if (!filename || !filename.match(/^[a-zA-Z0-9_-]+\.json$/)) {
    return res.status(400).json({ 
      error: 'Nom de fichier invalide', 
      message: 'Le nom de fichier doit contenir uniquement des lettres, chiffres, tirets et underscores, et se terminer par .json'
    });
  }
  
  const filePath = path.join(__dirname, 'data/conversions', filename);
  
  // Vérifier que le fichier existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ 
      error: 'Fichier non trouvé', 
      message: `Le fichier ${filename} n'existe pas`
    });
  }
  
  // Envoyer le fichier
  res.sendFile(filePath);
});

// Routes pour les terminologies
app.get('/api/terminology/systems', (req, res) => {
  const systems = frenchTerminologyAdapter.getAllTerminologySystems();
  
  if (!systems) {
    return res.status(500).json({ 
      error: 'Erreur serveur', 
      message: 'Impossible de charger les systèmes de terminologie'
    });
  }
  
  res.json(systems);
});

app.get('/api/terminology/oid/:oid', (req, res) => {
  const oid = req.params.oid;
  
  // Vérifier que l'OID est valide
  if (!oid || !oid.match(/^[0-9.]+$/)) {
    return res.status(400).json({ 
      error: 'OID invalide', 
      message: 'L\'OID doit contenir uniquement des chiffres et des points'
    });
  }
  
  const system = frenchTerminologyAdapter.getCodeSystemByOid(oid);
  
  if (!system) {
    return res.status(404).json({ 
      error: 'Système non trouvé', 
      message: `Aucun système trouvé avec l'OID ${oid}`
    });
  }
  
  res.json(system);
});

app.get('/api/terminology/search', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ 
      error: 'Requête invalide', 
      message: 'La requête de recherche doit contenir au moins 2 caractères'
    });
  }
  
  const systems = frenchTerminologyAdapter.getAllTerminologySystems();
  
  if (!systems) {
    return res.status(500).json({ 
      error: 'Erreur serveur', 
      message: 'Impossible de charger les systèmes de terminologie'
    });
  }
  
  // Rechercher dans tous les systèmes
  const results = [];
  const queryLower = query.toLowerCase();
  
  Object.values(systems).forEach(system => {
    // Vérifier si le nom, la description ou l'OID correspondent à la requête
    if (system.name && system.name.toLowerCase().includes(queryLower) ||
        system.oid && system.oid.includes(queryLower) ||
        system.title && system.title.toLowerCase().includes(queryLower) ||
        system.description && system.description.toLowerCase().includes(queryLower)) {
      results.push(system);
    }
  });
  
  res.json(results);
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Pour toutes les autres routes non-API, servir la page d'index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

// Route de fallback générique
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur FHIRHub démarré sur le port ${PORT}`);
  console.log(`API accessible à l'adresse http://localhost:${PORT}/api`);
  console.log(`Interface web accessible à l'adresse http://localhost:${PORT}`);
});

module.exports = app;