/**
 * Application FHIRHub simplifiée
 * Convertisseur HL7 v2.5 vers FHIR R4
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Base de données SQLite simplifiée
const Database = require('better-sqlite3');
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const db = new Database('./data/fhirhub.db');

// Initialisation de la base de données
function initDb() {
  console.log('Initialisation de la base de données SQLite...');
  
  db.exec(`CREATE TABLE IF NOT EXISTS conversion_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input_message TEXT NOT NULL,
    output_message TEXT,
    status TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )`);
  
  console.log('Base de données initialisée avec succès.');
}

// Route de base
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FHIRHub API en ligne',
    version: '1.0.0'
  });
});

// Route pour la conversion
app.post('/api/convert', (req, res) => {
  try {
    const { hl7Message } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    // Simuler la conversion
    const segments = hl7Message.replace(/\n/g, '\r').split('\r').filter(Boolean);
    const result = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: segments.map((segment, index) => ({
        fullUrl: `urn:uuid:${index}`,
        resource: { resourceType: 'Basic', id: `segment-${index}` },
        request: { method: 'POST', url: 'Basic' }
      }))
    };
    
    // Enregistrement de la conversion
    db.prepare(`
      INSERT INTO conversion_logs (
        input_message,
        output_message,
        status,
        timestamp
      ) VALUES (?, ?, ?, datetime('now'))
    `).run(
      hl7Message.length > 1000 ? hl7Message.substring(0, 1000) + '...' : hl7Message,
      JSON.stringify(result).length > 1000 ? JSON.stringify(result).substring(0, 1000) + '...' : JSON.stringify(result),
      'success'
    );
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[CONVERSION ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Conversion Error',
      message: error.message || 'Erreur inconnue'
    });
  }
});

// Statistiques
app.get('/api/stats', (req, res) => {
  try {
    const conversionCount = db.prepare('SELECT COUNT(*) as count FROM conversion_logs').get();
    
    res.json({
      success: true,
      data: {
        conversions: conversionCount.count,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error('[STATS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Stats Error',
      message: error.message || 'Erreur inconnue'
    });
  }
});

// Démarrage de l'application
initDb();
app.listen(PORT, () => {
  console.log(`[SERVER] FHIRHub démarré sur le port ${PORT}`);
});