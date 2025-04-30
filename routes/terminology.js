/**
 * Routes de gestion des terminologies françaises
 * Permet l'import, l'export et la gestion des fichiers de terminologie
 * @module routes/terminology
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const authCombined = require('../middleware/authCombined');

// Middleware pour vérifier si l'utilisateur est administrateur
const jwtAuth = require('../middleware/jwtAuth');

// Middleware d'authentification administrateur avec JWT
const adminAuthMiddleware = jwtAuth({
  required: true,
  roles: ['admin']
});

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function(req, file, cb) {
    // Utiliser le nom original du fichier 
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: function(req, file, cb) {
    // Accepter uniquement les fichiers JSON
    if (file.mimetype !== 'application/json' && !file.originalname.endsWith('.json')) {
      return cb(new Error('Seuls les fichiers JSON sont acceptés'), false);
    }
    cb(null, true);
  }
});

// Répertoire des terminologies
const TERMINOLOGY_DIR = path.join(__dirname, '../french_terminology');

/**
 * @swagger
 * /api/terminology/french:
 *   get:
 *     summary: Obtenir les informations sur les terminologies françaises
 *     description: Retourne les informations sur les systèmes de terminologie français utilisés pour la conversion
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Informations récupérées avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/french', adminAuthMiddleware, async (req, res) => {
  try {
    // Récupérer les données des terminologies
    const systems = getJsonFileContent('ans_terminology_systems.json');
    const oids = getJsonFileContent('ans_oids.json');
    const commonCodes = getJsonFileContent('ans_common_codes.json');
    
    // Compter le nombre d'éléments
    const systemsCount = systems ? Object.keys(systems).length : 0;
    const oidsCount = oids?.identifier_systems ? Object.keys(oids.identifier_systems).length : 0;
    
    res.json({
      success: true,
      data: {
        version: '1.0.0', // Valeur par défaut hardcodée
        lastUpdated: new Date().toISOString(),
        systems: systems || {},
        oids: oids?.identifier_systems || {},
        systemsCount: systemsCount,
        oidsCount: oidsCount
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des terminologies :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des terminologies françaises',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files:
 *   get:
 *     summary: Obtenir la liste des fichiers de terminologie
 *     description: Retourne la liste des fichiers de terminologie disponibles
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(TERMINOLOGY_DIR, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des fichiers de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers de terminologie',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}:
 *   get:
 *     summary: Obtenir le contenu d'un fichier de terminologie
 *     description: Retourne le contenu d'un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contenu récupéré avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files/:filename', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    const content = getJsonFileContent(filename);
    res.json(content);
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération du fichier ${req.params.filename}`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}/download:
 *   get:
 *     summary: Télécharger un fichier de terminologie
 *     description: Télécharge un fichier de terminologie spécifique
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier téléchargé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/files/:filename/download', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`[API] Erreur lors du téléchargement du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors du téléchargement du fichier ${req.params.filename}`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/import:
 *   post:
 *     summary: Importer un fichier de terminologie
 *     description: Importe un fichier de terminologie au format JSON
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 description: Type de terminologie (oids, common_codes, systems, valuesets, r4_systems, r5_systems, auto)
 *     responses:
 *       200:
 *         description: Fichier importé avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/import', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    // Lire le fichier téléchargé
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    let jsonData;
    
    try {
      jsonData = JSON.parse(fileContent);
    } catch (err) {
      // Supprimer le fichier temporaire
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        message: 'Le fichier n\'est pas un JSON valide',
        error: err.message
      });
    }
    
    // Déterminer le nom du fichier de destination
    let destFilename = '';
    const type = req.body.type || 'auto';
    
    if (type === 'oids' || req.file.originalname.includes('oids')) {
      destFilename = 'ans_oids.json';
    } else if (type === 'common_codes' || req.file.originalname.includes('common_codes')) {
      destFilename = 'ans_common_codes.json';
    } else if (type === 'systems' || req.file.originalname.includes('terminology_systems')) {
      destFilename = 'ans_terminology_systems.json';
    } else if (type === 'valuesets' || req.file.originalname.includes('valuesets')) {
      destFilename = 'fhir_valuesets.json';
    } else if (type === 'codesystems' || req.file.originalname.includes('codesystems')) {
      destFilename = 'fhir_codesystems.json';
    } else if (type === 'r4_systems' || req.file.originalname.includes('r4_french')) {
      destFilename = 'fhir_r4_french_systems.json';
    } else if (type === 'r5_systems' || req.file.originalname.includes('r5_french')) {
      destFilename = 'fhir_r5_french_systems.json';
    } else {
      // Déterminer le type en fonction du contenu
      if (jsonData.systems && (jsonData.systems.ins || jsonData.systems.rpps)) {
        destFilename = 'ans_oids.json';
      } else if (jsonData.codeSystemMap && (jsonData.codeSystemMap.profession || jsonData.codeSystemMap.movement)) {
        destFilename = 'ans_common_codes.json';
      } else if (jsonData.systems || jsonData.codeSystemMap) {
        destFilename = 'ans_terminology_systems.json';
      } else {
        // Utiliser le nom original du fichier mais le préfixer avec ans_ pour les nouveaux fichiers
        destFilename = req.file.originalname.startsWith('ans_') 
          ? req.file.originalname 
          : `ans_${req.file.originalname}`;
      }
    }
    
    // S'assurer que jsonData a une date de mise à jour
    if (!jsonData.lastUpdated) {
      jsonData.lastUpdated = new Date().toISOString();
    }
    
    // S'assurer que jsonData a une version
    if (!jsonData.version) {
      jsonData.version = '1.0.0';
    }
    
    // Écrire le fichier de destination
    const destPath = path.join(TERMINOLOGY_DIR, destFilename);
    fs.writeFileSync(destPath, JSON.stringify(jsonData, null, 2));
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);
    
    console.log(`[TERMINOLOGY] Fichier ${destFilename} importé avec succès`);
    
    res.json({
      success: true,
      message: 'Fichier importé avec succès',
      data: {
        originalName: req.file.originalname,
        destinationName: destFilename,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'importation du fichier :', error);
    
    // Supprimer le fichier temporaire si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'importation du fichier',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/export:
 *   get:
 *     summary: Exporter toutes les terminologies
 *     description: Exporte toutes les terminologies au format ZIP
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Terminologies exportées avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/export', adminAuthMiddleware, async (req, res) => {
  try {
    const exportFilename = `terminologies_export_${new Date().toISOString().substring(0, 10)}.zip`;
    
    // Créer un fichier ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${exportFilename}`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Niveau de compression maximum
    });
    
    // Gérer les erreurs
    archive.on('error', (err) => {
      console.error('[API] Erreur lors de la création du ZIP :', err);
      res.status(500).send('Erreur lors de la création du fichier ZIP');
    });
    
    // Pipe l'archive vers la réponse
    archive.pipe(res);
    
    // Ajouter tous les fichiers JSON du répertoire de terminologies
    const files = fs.readdirSync(TERMINOLOGY_DIR).filter(file => file.endsWith('.json'));
    files.forEach(file => {
      const filePath = path.join(TERMINOLOGY_DIR, file);
      archive.file(filePath, { name: file });
    });
    
    // Finaliser l'archive
    archive.finalize();
  } catch (error) {
    console.error('[API] Erreur lors de l\'exportation des terminologies :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'exportation des terminologies',
      error: error.message
    });
  }
});

/**
 * Récupérer le contenu d'un fichier JSON
 * @param {string} filename - Nom du fichier
 * @returns {Object} Contenu du fichier JSON
 */
function getJsonFileContent(filename) {
  try {
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[TERMINOLOGY] Fichier non trouvé: ${filename}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[TERMINOLOGY] Erreur lors de la lecture du fichier ${filename} :`, error);
    return null;
  }
}

module.exports = router;