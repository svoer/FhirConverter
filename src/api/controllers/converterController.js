/**
 * Contrôleur de conversion HL7 vers FHIR
 * Gère les endpoints de conversion de messages HL7
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const hl7ToFhirConverter = require('../../hl7ToFhirConverter');
const conversionLogService = require('../../services/conversionLogService');
const fileMonitor = require('../../fileMonitor');

// Dossiers de stockage des fichiers
const DATA_DIR = process.env.DATA_DIR || 'data';
const INPUT_DIR = path.join(DATA_DIR, 'in');
const OUTPUT_DIR = path.join(DATA_DIR, 'out');

// Créer les dossiers s'ils n'existent pas
async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(INPUT_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (err) {
    console.error('[CONVERTER] Erreur lors de la création des dossiers:', err);
  }
}

// Initialiser les dossiers au démarrage
ensureDirectoriesExist();

/**
 * Convertir un contenu HL7 en FHIR
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function convertHL7Content(req, res) {
  try {
    const { content } = req.body;
    
    // Vérifier que le contenu HL7 est fourni
    if (!content) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le contenu HL7 à convertir est requis' 
      });
    }
    
    // Informations d'authentification pour le log
    const apiAuth = req.apiAuth || {};
    
    // Générer des noms de fichiers uniques
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').replace('T', '_').substring(0, 15);
    const requestId = uuidv4().substring(0, 8);
    const sourceFilename = `${timestamp}_${requestId}.hl7`;
    const targetFilename = `${timestamp}_${requestId}.json`;
    
    // Sauvegarder le contenu HL7 dans un fichier
    const sourcePath = path.join(INPUT_DIR, sourceFilename);
    await fs.writeFile(sourcePath, content);
    
    console.log(`[API] Début de la conversion du contenu HL7 (${sourcePath})`);
    
    // Convertir le contenu HL7 en FHIR
    const startTime = Date.now();
    
    let fhirBundle;
    let status = 'success';
    let errorMessage = null;
    
    try {
      // Effectuer la conversion
      fhirBundle = await hl7ToFhirConverter.convertHL7ToFHIR(content);
    } catch (conversionError) {
      console.error('[API] Erreur lors de la conversion:', conversionError);
      status = 'error';
      errorMessage = conversionError.message;
      
      // Renvoyer l'erreur au client
      return res.status(400).json({
        error: 'Erreur de conversion',
        message: 'La conversion du message HL7 a échoué',
        details: conversionError.message
      });
    }
    
    // Calculer le temps de conversion
    const conversionTime = Date.now() - startTime;
    
    // Sauvegarder le bundle FHIR dans un fichier
    const targetPath = path.join(OUTPUT_DIR, targetFilename);
    await fs.writeFile(targetPath, JSON.stringify(fhirBundle, null, 2));
    
    console.log(`[API] Conversion réussie (${conversionTime}ms): ${targetPath}`);
    
    // Journaliser la conversion
    await conversionLogService.createConversionLog({
      applicationId: apiAuth.applicationId,
      apiKeyId: apiAuth.apiKeyId,
      requestType: 'api',
      sourceFilename: sourceFilename,
      targetFilename: targetFilename,
      status,
      message: status === 'success' ? 'Conversion réussie' : 'Erreur de conversion',
      errorDetails: errorMessage,
      conversionTime,
      inputSize: Buffer.byteLength(content, 'utf8'),
      outputSize: Buffer.byteLength(JSON.stringify(fhirBundle), 'utf8'),
      requestIp: req.ip,
      requestEndpoint: req.originalUrl,
      resourceCount: fhirBundle.entry ? fhirBundle.entry.length : 0
    });
    
    // Renvoyer le bundle FHIR au client
    res.json({
      message: 'Conversion réussie',
      conversionTime,
      sourceFilename,
      targetFilename,
      resourceCount: fhirBundle.entry ? fhirBundle.entry.length : 0,
      result: fhirBundle
    });
  } catch (error) {
    console.error('[API] Erreur lors de la conversion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la conversion',
      details: error.message
    });
  }
}

/**
 * Traiter un fichier HL7 téléchargé
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function processUploadedFile(req, res) {
  try {
    // Vérifier que le fichier a été téléchargé
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Fichier manquant',
        message: 'Aucun fichier n\'a été téléchargé' 
      });
    }
    
    const sourceFilename = req.file.filename || path.basename(req.file.path);
    const sourcePath = req.file.path;
    
    console.log(`[API] Fichier HL7 téléchargé: ${sourcePath}`);
    
    // Informations d'authentification pour le log
    const apiAuth = req.apiAuth || {};
    
    // Générer un nom de fichier unique pour la sortie
    const targetFilename = sourceFilename.replace(/\.[^.]+$/, '.json');
    const targetPath = path.join(OUTPUT_DIR, targetFilename);
    
    // Lire le contenu du fichier
    const content = await fs.readFile(sourcePath, 'utf8');
    
    console.log(`[API] Début de la conversion du fichier HL7 (${sourceFilename})`);
    
    // Convertir le contenu HL7 en FHIR
    const startTime = Date.now();
    
    let fhirBundle;
    let status = 'success';
    let errorMessage = null;
    
    try {
      // Effectuer la conversion
      fhirBundle = await hl7ToFhirConverter.convertHL7ToFHIR(content);
    } catch (conversionError) {
      console.error('[API] Erreur lors de la conversion du fichier:', conversionError);
      status = 'error';
      errorMessage = conversionError.message;
      
      // Renvoyer l'erreur au client
      return res.status(400).json({
        error: 'Erreur de conversion',
        message: 'La conversion du fichier HL7 a échoué',
        details: conversionError.message
      });
    }
    
    // Calculer le temps de conversion
    const conversionTime = Date.now() - startTime;
    
    // Sauvegarder le bundle FHIR dans un fichier
    await fs.writeFile(targetPath, JSON.stringify(fhirBundle, null, 2));
    
    console.log(`[API] Conversion de fichier réussie (${conversionTime}ms): ${targetPath}`);
    
    // Journaliser la conversion
    await conversionLogService.createConversionLog({
      applicationId: apiAuth.applicationId,
      apiKeyId: apiAuth.apiKeyId,
      requestType: 'upload',
      sourceFilename: sourceFilename,
      targetFilename: targetFilename,
      status,
      message: status === 'success' ? 'Conversion de fichier réussie' : 'Erreur de conversion du fichier',
      errorDetails: errorMessage,
      conversionTime,
      inputSize: Buffer.byteLength(content, 'utf8'),
      outputSize: Buffer.byteLength(JSON.stringify(fhirBundle), 'utf8'),
      requestIp: req.ip,
      requestEndpoint: req.originalUrl,
      resourceCount: fhirBundle.entry ? fhirBundle.entry.length : 0
    });
    
    // Renvoyer le bundle FHIR au client
    res.json({
      message: 'Conversion de fichier réussie',
      conversionTime,
      sourceFilename,
      targetFilename,
      resourceCount: fhirBundle.entry ? fhirBundle.entry.length : 0,
      downloadUrl: `/api/files/fhir/${targetFilename}`,
      result: fhirBundle
    });
  } catch (error) {
    console.error('[API] Erreur lors du traitement du fichier:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors du traitement du fichier',
      details: error.message
    });
  }
}

/**
 * Télécharger un fichier FHIR
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function downloadFhirFile(req, res) {
  try {
    const filename = req.params.filename;
    
    // Valider le nom de fichier pour éviter les attaques de traversée de chemin
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ 
        error: 'Nom de fichier invalide',
        message: 'Le nom de fichier fourni est invalide' 
      });
    }
    
    const filePath = path.join(OUTPUT_DIR, filename);
    
    // Vérifier si le fichier existe
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ 
        error: 'Fichier non trouvé',
        message: 'Le fichier demandé n\'existe pas' 
      });
    }
    
    // Envoyer le fichier
    res.download(filePath, filename);
  } catch (error) {
    console.error('[API] Erreur lors du téléchargement du fichier:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors du téléchargement du fichier',
      details: error.message
    });
  }
}

/**
 * Démarrer la surveillance des fichiers
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function startFileMonitoring(req, res) {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Le répertoire à surveiller est requis' 
      });
    }
    
    // Vérifier que le répertoire existe
    try {
      await fs.access(directory);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Répertoire invalide',
        message: 'Le répertoire spécifié n\'existe pas' 
      });
    }
    
    // Démarrer la surveillance
    fileMonitor.startMonitoring(directory);
    
    res.json({
      message: 'Surveillance des fichiers démarrée',
      directory
    });
  } catch (error) {
    console.error('[API] Erreur lors du démarrage de la surveillance:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors du démarrage de la surveillance',
      details: error.message
    });
  }
}

/**
 * Arrêter la surveillance des fichiers
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
function stopFileMonitoring(req, res) {
  try {
    // Arrêter la surveillance
    fileMonitor.stopMonitoring();
    
    res.json({
      message: 'Surveillance des fichiers arrêtée'
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'arrêt de la surveillance:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de l\'arrêt de la surveillance',
      details: error.message
    });
  }
}

/**
 * Analyser les fichiers existants dans le répertoire
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
async function scanDirectory(req, res) {
  try {
    const scanResult = await fileMonitor.scanDirectory();
    
    res.json({
      message: 'Analyse du répertoire terminée',
      scannedFiles: scanResult.scannedFiles,
      processedFiles: scanResult.processedFiles
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'analyse du répertoire:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de l\'analyse du répertoire',
      details: error.message
    });
  }
}

module.exports = {
  convertHL7Content,
  processUploadedFile,
  downloadFhirFile,
  startFileMonitoring,
  stopFileMonitoring,
  scanDirectory
};