/**
 * Routeur API simplifié pour FHIRHub
 * Fournit des endpoints pour la conversion HL7 vers FHIR R4
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Importer le convertisseur et les adaptateurs
const converter = require('./hl7ToFhirConverter.proxy');
const frenchTerminologyAdapter = require('./french_terminology_adapter');
const fhirCleaner = require('./fhir_cleaner');

// Configuration pour l'upload de fichiers
const upload = multer({
  dest: 'data/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * GET /health
 * Point d'entrée pour vérifier la santé du serveur
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0' 
  });
});

/**
 * GET /info
 * Informations sur le serveur
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'FHIRHub',
    description: 'Convertisseur HL7 v2.5 vers FHIR R4',
    version: '1.0.0',
    frenchTerminologies: frenchTerminologyAdapter.getAllTerminologySystems() ? 'loaded' : 'not_loaded'
  });
});

/**
 * GET /terminology/systems
 * Récupérer tous les systèmes de terminologie disponibles
 */
router.get('/terminology/systems', (req, res) => {
  const systems = frenchTerminologyAdapter.getAllTerminologySystems();
  
  if (!systems) {
    return res.status(500).json({ 
      error: 'Erreur serveur', 
      message: 'Impossible de charger les systèmes de terminologie'
    });
  }
  
  res.json(systems);
});

/**
 * GET /stats
 * Retourne des statistiques simples pour le dashboard
 */
router.get('/stats', (req, res) => {
  res.json({
    totalConversions: 0,
    successfulConversions: 0,
    failedConversions: 0,
    resourcesGenerated: 0,
    recentActivity: []
  });
});

/**
 * GET /conversions
 * Retourne l'historique des conversions
 */
router.get('/conversions', (req, res) => {
  res.json([]);
});

/**
 * POST /convert
 * Convertir du contenu HL7 en FHIR
 */
router.post('/convert', async (req, res) => {
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
  
  try {
    // Conversion avec le proxy
    const result = await converter.convertHl7Content(hl7Content, "saisie_directe.hl7", options);
    
    // Envoyer le résultat
    res.json(result);
  } catch (error) {
    console.error('[SERVER] Erreur lors de la conversion:', error);
    
    res.status(500).json({ 
      status: 'error',
      message: `Erreur de conversion: ${error.message}`,
      error: error.stack
    });
  }
});

/**
 * POST /upload
 * Télécharger et convertir un fichier HL7
 */
router.post('/upload', upload.single('file'), async (req, res) => {
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
    
    // Conversion
    const result = await converter.convertHl7Content(hl7Content, req.file.originalname, options);
    
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

/**
 * GET /terminology/oid/:oid
 * Récupérer un système de terminologie par son OID
 */
router.get('/terminology/oid/:oid', (req, res) => {
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

/**
 * GET /terminology/search
 * Rechercher dans les systèmes de terminologie
 */
router.get('/terminology/search', (req, res) => {
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

module.exports = router;