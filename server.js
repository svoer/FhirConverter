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

// Importer le routeur API simplifié
const apiRouter = require('./apiRouter');

// Utiliser le routeur API (sans authentification pour simplifier)
app.use('/api', apiRouter);

// Toutes les routes API sont maintenant gérées par apiRouter
// Fonction de conversion pour référence future
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