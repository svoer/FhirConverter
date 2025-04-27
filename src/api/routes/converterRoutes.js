/**
 * Routes de conversion HL7 vers FHIR
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const converterController = require('../controllers/converterController');
const apiKeyAuth = require('../middleware/apiKeyMiddleware');
const { authenticated, adminRequired } = require('../middleware/authMiddleware');

// Configuration de multer pour le téléchargement de fichiers
const upload = multer({
  dest: 'data/in/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.hl7' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers .hl7 et .txt sont acceptés'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
});

// Routes non authentifiées avec clé API obligatoire
router.post('/convert', apiKeyAuth(), converterController.convertHL7Content);
router.post('/upload', apiKeyAuth(), upload.single('file'), converterController.processUploadedFile);
router.get('/files/fhir/:filename', converterController.downloadFhirFile);

// Routes administrateur pour la surveillance des fichiers
// Ces routes nécessitent une authentification JWT
router.post('/monitor/start', authenticated, adminRequired, converterController.startFileMonitoring);
router.post('/monitor/stop', authenticated, adminRequired, converterController.stopFileMonitoring);
router.post('/monitor/scan', authenticated, adminRequired, converterController.scanDirectory);

module.exports = router;