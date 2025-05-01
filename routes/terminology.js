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

// Middleware d'authentification administrateur combinée (JWT ou API Key)
// Le middleware authCombined ne bloque pas la requête, il ajoute juste req.isAuthenticated()
// Nous continuons à utiliser jwtAuth pour les routes qui nécessitent un rôle spécifique
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
 *               description:
 *                 type: string
 *                 description: Description personnalisée pour ce fichier de terminologie
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
    
    // Ajouter des métadonnées personnalisées
    if (!jsonData.metadata) {
      jsonData.metadata = {};
    }
    
    // Ajouter ou mettre à jour la description
    if (req.body.description) {
      jsonData.metadata.description = req.body.description;
    } else if (!jsonData.metadata.description) {
      jsonData.metadata.description = `Importé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    }
    
    // Ajouter des informations d'import
    jsonData.metadata.importDate = new Date().toISOString();
    jsonData.metadata.importedBy = req.user ? req.user.username : 'admin';
    jsonData.metadata.originalFilename = req.file.originalname;
    
    // Analyser le contenu pour des statistiques détaillées
    const stats = analyzeTerminologyContent(jsonData);
    jsonData.metadata.stats = stats;
    
    // Écrire le fichier de destination
    const destPath = path.join(TERMINOLOGY_DIR, destFilename);
    fs.writeFileSync(destPath, JSON.stringify(jsonData, null, 2));
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);
    
    // Log détaillé
    console.log(`[TERMINOLOGY] Fichier ${destFilename} importé avec succès`);
    console.log(`[TERMINOLOGY] Contenu analysé: ${JSON.stringify(stats)}`);
    
    res.json({
      success: true,
      message: 'Fichier importé avec succès',
      data: {
        originalName: req.file.originalname,
        destinationName: destFilename,
        size: req.file.size,
        description: jsonData.metadata.description,
        stats: stats
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
 * @swagger
 * /api/terminology/files/{filename}:
 *   delete:
 *     summary: Supprimer un fichier de terminologie
 *     description: Supprime un fichier de terminologie spécifique
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
 *         description: Fichier supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/files/:filename', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Vérifier que ce n'est pas un fichier système essentiel
    const systemFiles = ['ans_oids.json', 'ans_common_codes.json', 'ans_terminology_systems.json'];
    if (systemFiles.includes(filename)) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un fichier système. Vous pouvez le remplacer en important une nouvelle version.'
      });
    }
    
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    fs.unlinkSync(filePath);
    
    console.log(`[TERMINOLOGY] Fichier ${filename} supprimé avec succès`);
    
    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la suppression du fichier`,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/files/{filename}/metadata:
 *   put:
 *     summary: Mettre à jour les métadonnées d'un fichier de terminologie
 *     description: Met à jour la description et autres métadonnées d'un fichier
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Métadonnées mises à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/files/:filename/metadata', adminAuthMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    if (!req.body || typeof req.body.description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description invalide'
      });
    }
    
    // Lire le fichier
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let jsonData = JSON.parse(fileContent);
    
    // Ajouter/mettre à jour les métadonnées
    if (!jsonData.metadata) {
      jsonData.metadata = {};
    }
    
    // Mettre à jour la description
    jsonData.metadata.description = req.body.description;
    jsonData.metadata.lastUpdated = new Date().toISOString();
    jsonData.metadata.updatedBy = req.user ? req.user.username : 'admin';
    
    // Écrire le fichier mis à jour
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    
    console.log(`[TERMINOLOGY] Métadonnées du fichier ${filename} mises à jour avec succès`);
    
    res.json({
      success: true,
      message: 'Métadonnées mises à jour avec succès',
      data: {
        filename,
        description: jsonData.metadata.description
      }
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la mise à jour des métadonnées du fichier ${req.params.filename} :`, error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la mise à jour des métadonnées`,
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

/**
 * Analyser le contenu d'un fichier de terminologie pour générer des statistiques détaillées
 * @param {Object} jsonData - Contenu JSON d'un fichier de terminologie
 * @returns {Object} Statistiques sur le contenu du fichier
 */
function analyzeTerminologyContent(jsonData) {
  const stats = {
    resourceType: jsonData.resourceType || 'Unknown',
    totalElements: 0,
    totalSystems: 0,
    detectedTypes: [],
    keyElements: []
  };
  
  // Analyser en fonction du type de ressource FHIR
  if (jsonData.resourceType === 'CodeSystem') {
    stats.detectedTypes.push('CodeSystem');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.totalElements = jsonData.concept ? jsonData.concept.length : 0;
    stats.name = jsonData.name || jsonData.title;
    
    // Extraire quelques concepts clés pour montrer dans les logs
    if (jsonData.concept && jsonData.concept.length > 0) {
      stats.keyElements = jsonData.concept.slice(0, 5).map(c => ({
        code: c.code,
        display: c.display
      }));
    }
  } else if (jsonData.resourceType === 'ValueSet') {
    stats.detectedTypes.push('ValueSet');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.name = jsonData.name || jsonData.title;
    
    if (jsonData.compose && jsonData.compose.include) {
      stats.totalSystems = jsonData.compose.include.length;
      stats.systems = jsonData.compose.include.map(i => i.system);
    }
  } else if (jsonData.resourceType === 'Bundle') {
    stats.detectedTypes.push('Bundle');
    stats.totalElements = jsonData.entry ? jsonData.entry.length : 0;
    
    // Analyser les types de ressources dans le bundle
    if (jsonData.entry && jsonData.entry.length > 0) {
      const resourceTypes = {};
      jsonData.entry.forEach(entry => {
        if (entry.resource && entry.resource.resourceType) {
          const type = entry.resource.resourceType;
          resourceTypes[type] = (resourceTypes[type] || 0) + 1;
        }
      });
      stats.resourceTypes = resourceTypes;
    }
  } else if (jsonData.resourceType === 'TerminologyCapabilities') {
    stats.detectedTypes.push('TerminologyCapabilities');
    stats.url = jsonData.url;
    stats.version = jsonData.version;
    stats.name = jsonData.name || jsonData.title;
    
    if (jsonData.codeSystem) {
      stats.totalSystems = jsonData.codeSystem.length;
      stats.systems = jsonData.codeSystem.map(cs => cs.uri);
    }
  } else if (jsonData.systems) {
    // Format spécifique des systèmes de terminologie ANS
    stats.detectedTypes.push('ANS-Systems');
    stats.totalSystems = Object.keys(jsonData.systems).length;
    stats.systems = Object.keys(jsonData.systems);
    
    // Récupérer quelques systèmes clés
    stats.keyElements = Object.entries(jsonData.systems)
      .slice(0, 5)
      .map(([key, value]) => ({
        key,
        url: typeof value === 'object' ? value.url : value
      }));
  } else if (jsonData.identifier_systems) {
    // Format spécifique des OIDs ANS
    stats.detectedTypes.push('ANS-OIDs');
    stats.totalSystems = Object.keys(jsonData.identifier_systems).length;
    stats.systems = Object.keys(jsonData.identifier_systems);
    
    // Récupérer quelques OIDs clés
    stats.keyElements = Object.entries(jsonData.identifier_systems)
      .slice(0, 5)
      .map(([key, value]) => ({
        key,
        oid: value
      }));
  } else if (jsonData.codeSystemMap) {
    // Format spécifique des codes communs ANS
    stats.detectedTypes.push('ANS-CommonCodes');
    stats.totalSystems = Object.keys(jsonData.codeSystemMap).length;
    stats.systems = Object.keys(jsonData.codeSystemMap);
    
    let totalCodes = 0;
    Object.values(jsonData.codeSystemMap).forEach(system => {
      if (typeof system === 'object') {
        totalCodes += Object.keys(system).length;
      }
    });
    stats.totalElements = totalCodes;
  }
  
  return stats;
}

/**
 * @swagger
 * /api/terminology/analyze:
 *   post:
 *     summary: Analyser tous les fichiers de terminologie
 *     description: Analyse le contenu de tous les fichiers de terminologie pour fournir des statistiques détaillées
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Analyse terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/analyze', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'));
    
    // Résultats d'analyse
    const results = {
      filesAnalyzed: files.length,
      totalItems: 0,
      systemsFound: 0,
      oidsFound: 0,
      fileTypes: {},
      details: []
    };
    
    // Analyser chaque fichier
    for (const filename of files) {
      const filePath = path.join(TERMINOLOGY_DIR, filename);
      const stats = fs.statSync(filePath);
      
      try {
        // Lire et analyser le contenu
        const content = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        // Utiliser la fonction d'analyse existante
        const fileAnalysis = analyzeTerminologyContent(jsonData);
        
        // Ajouter à l'analyse globale
        results.totalItems += fileAnalysis.totalElements || 0;
        results.systemsFound += fileAnalysis.totalSystems || 0;
        
        // Compter les types de fichiers
        const fileType = fileAnalysis.detectedTypes[0] || 'Unknown';
        results.fileTypes[fileType] = (results.fileTypes[fileType] || 0) + 1;
        
        // Ajouter aux détails
        results.details.push({
          filename,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: fileType,
          itemCount: fileAnalysis.totalElements || 0,
          systemsCount: fileAnalysis.totalSystems || 0
        });
        
        // Si c'est un fichier d'OIDs
        if (fileType === 'ANS-OIDs') {
          results.oidsFound += fileAnalysis.totalSystems || 0;
        }
      } catch (error) {
        console.error(`[TERMINOLOGY] Erreur lors de l'analyse du fichier ${filename}:`, error);
        
        // Ajouter quand même aux détails mais avec une erreur
        results.details.push({
          filename,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          error: error.message
        });
      }
    }
    
    console.log(`[TERMINOLOGY] Analyse de ${files.length} fichiers terminée. ${results.totalItems} éléments trouvés.`);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'analyse des fichiers de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des fichiers de terminologie',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/check-duplicates:
 *   get:
 *     summary: Vérifier les fichiers de terminologie en doublon
 *     description: Identifie les fichiers de terminologie qui contiennent des données similaires
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Vérification terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/check-duplicates', adminAuthMiddleware, async (req, res) => {
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
    
    // Regrouper les fichiers par taille similaire (taille à ±10%)
    const sizeGroups = {};
    files.forEach(file => {
      const sizeKey = Math.floor(file.size / 1000) * 1000; // Arrondir à 1KB près
      sizeGroups[sizeKey] = sizeGroups[sizeKey] || [];
      sizeGroups[sizeKey].push(file);
    });
    
    // Garder uniquement les groupes avec plus d'un fichier
    const potentialDuplicateGroups = Object.values(sizeGroups)
      .filter(group => group.length > 1);
    
    // Analyser le contenu des fichiers potentiellement en doublon
    const confirmedDuplicates = [];
    
    for (const group of potentialDuplicateGroups) {
      // Grouper par noms similaires (ex: similaires si seule la date diffère)
      const nameGroups = {};
      
      group.forEach(file => {
        // Créer une clé de base de nom sans dates/nombres
        const baseNameKey = file.name
          .replace(/\d+/g, 'X')         // Remplacer tous les chiffres par X
          .replace(/[-_\.]/g, '')       // Ignorer les tirets, underscore et points
          .toLowerCase();
        
        nameGroups[baseNameKey] = nameGroups[baseNameKey] || [];
        nameGroups[baseNameKey].push(file);
      });
      
      // Garder les groupes avec plusieurs fichiers
      const duplicateNameGroups = Object.values(nameGroups)
        .filter(nameGroup => nameGroup.length > 1);
      
      if (duplicateNameGroups.length > 0) {
        // Pour chaque groupe de noms similaires, vérifier le contenu
        for (const nameGroup of duplicateNameGroups) {
          // Trier par date de dernière modification (du plus récent au plus ancien)
          nameGroup.sort((a, b) => 
            new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
          );
          
          confirmedDuplicates.push({
            type: 'name_similarity',
            files: nameGroup
          });
        }
      }
    }
    
    console.log(`[TERMINOLOGY] Vérification des doublons terminée. ${confirmedDuplicates.length} groupes identifiés.`);
    
    res.json({
      success: true,
      data: {
        totalFiles: files.length,
        duplicates: confirmedDuplicates
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la vérification des doublons :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des doublons',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/terminology/remove-duplicates:
 *   post:
 *     summary: Supprimer les fichiers de terminologie en doublon
 *     description: Supprime automatiquement les fichiers de terminologie en doublon en gardant les plus récents
 *     tags:
 *       - Terminologie
 *     security:
 *       - AdminAuth: []
 *     responses:
 *       200:
 *         description: Suppression terminée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/remove-duplicates', adminAuthMiddleware, async (req, res) => {
  try {
    // Réutiliser la logique de détection des doublons
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
    
    // Regrouper les fichiers par taille similaire (taille à ±10%)
    const sizeGroups = {};
    files.forEach(file => {
      const sizeKey = Math.floor(file.size / 1000) * 1000; // Arrondir à 1KB près
      sizeGroups[sizeKey] = sizeGroups[sizeKey] || [];
      sizeGroups[sizeKey].push(file);
    });
    
    // Garder uniquement les groupes avec plus d'un fichier
    const potentialDuplicateGroups = Object.values(sizeGroups)
      .filter(group => group.length > 1);
    
    // Fichiers à supprimer
    const filesToDelete = [];
    
    for (const group of potentialDuplicateGroups) {
      // Grouper par noms similaires
      const nameGroups = {};
      
      group.forEach(file => {
        // Créer une clé de base de nom sans dates/nombres
        const baseNameKey = file.name
          .replace(/\d+/g, 'X')
          .replace(/[-_\.]/g, '')
          .toLowerCase();
        
        nameGroups[baseNameKey] = nameGroups[baseNameKey] || [];
        nameGroups[baseNameKey].push(file);
      });
      
      // Garder les groupes avec plusieurs fichiers
      const duplicateNameGroups = Object.values(nameGroups)
        .filter(nameGroup => nameGroup.length > 1);
      
      for (const nameGroup of duplicateNameGroups) {
        // Trier par date de dernière modification (du plus récent au plus ancien)
        nameGroup.sort((a, b) => 
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        );
        
        // Conserver le fichier le plus récent, supprimer les autres
        const [newest, ...others] = nameGroup;
        filesToDelete.push(...others);
      }
    }
    
    // Vérifier et ne pas supprimer les fichiers système essentiels
    const systemFiles = ['ans_oids.json', 'ans_common_codes.json', 'ans_terminology_systems.json'];
    const safeFilesToDelete = filesToDelete.filter(file => !systemFiles.includes(file.name));
    
    // Effectuer la suppression
    let deletedCount = 0;
    for (const file of safeFilesToDelete) {
      const filePath = path.join(TERMINOLOGY_DIR, file.name);
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`[TERMINOLOGY] Fichier en doublon supprimé: ${file.name}`);
    }
    
    console.log(`[TERMINOLOGY] ${deletedCount} fichiers en doublon supprimés sur ${safeFilesToDelete.length} identifiés.`);
    
    res.json({
      success: true,
      data: {
        duplicatesFound: safeFilesToDelete.length,
        deleted: deletedCount
      }
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression des doublons :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des doublons',
      error: error.message
    });
  }
});

module.exports = router;