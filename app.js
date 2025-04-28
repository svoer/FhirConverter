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
  
  // Supprimer la table existante qui a une structure différente
  try {
    db.exec('DROP TABLE IF EXISTS conversion_logs');
  } catch (error) {
    console.error('Erreur lors de la suppression de la table:', error);
  }
  
  // Créer la nouvelle table avec notre structure
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
    
    // Convertir le message HL7 en FHIR
    const segments = hl7Message.replace(/\n/g, '\r').split('\r').filter(Boolean);
    
    // Analyser les segments du message HL7
    const mshSegment = segments.find(s => s.startsWith('MSH|')) || '';
    const pidSegment = segments.find(s => s.startsWith('PID|')) || '';
    const pv1Segment = segments.find(s => s.startsWith('PV1|')) || '';
    
    // Extraire les informations de base
    const mshParts = mshSegment.split('|');
    const pidParts = pidSegment.split('|');
    const pv1Parts = pv1Segment.split('|');
    
    // Créer un identifiant unique pour le Bundle
    const bundleId = 'bundle-' + Date.now();
    const patientId = 'patient-' + (pidParts[3] || Date.now());
    const encounterId = 'encounter-' + (pv1Parts[1] || Date.now());
    
    // Extraire le nom du patient
    let familyName = '';
    let givenNames = [];
    
    if (pidParts[5]) {
      const nameParts = pidParts[5].split('^');
      familyName = nameParts[0] || '';
      
      // Gérer les prénoms composés à la française
      if (nameParts[1]) {
        // Si le prénom contient des espaces, c'est un prénom composé
        if (nameParts[1].includes(' ')) {
          givenNames = nameParts[1].split(' ');
        } else {
          givenNames = [nameParts[1]];
        }
        
        // Ajouter les autres prénoms s'ils existent
        for (let i = 2; i < nameParts.length; i++) {
          if (nameParts[i]) {
            givenNames.push(nameParts[i]);
          }
        }
      }
    }
    
    // Extraire la date de naissance
    const birthDate = pidParts[7] ? 
      pidParts[7].substring(0, 4) + '-' + 
      pidParts[7].substring(4, 6) + '-' + 
      pidParts[7].substring(6, 8) : 
      null;
    
    // Extraire le sexe
    const gender = pidParts[8] === 'M' ? 'male' : 
                  pidParts[8] === 'F' ? 'female' : 
                  'unknown';
    
    // Créer le bundle FHIR
    const result = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'transaction',
      timestamp: new Date().toISOString(),
      entry: [
        // Patient
        {
          fullUrl: `urn:uuid:${patientId}`,
          resource: {
            resourceType: 'Patient',
            id: patientId,
            identifier: pidParts[3] ? [
              {
                system: 'urn:oid:1.2.250.1.213.1.4.8',
                value: pidParts[3].split('^')[0] || '',
                type: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                      code: 'PI',
                      display: 'Patient internal identifier'
                    }
                  ]
                }
              }
            ] : [],
            name: [
              {
                family: familyName,
                given: givenNames.length > 0 ? givenNames : undefined,
                use: 'official'
              }
            ],
            gender: gender,
            birthDate: birthDate
          },
          request: {
            method: 'POST',
            url: 'Patient'
          }
        }
      ]
    };
    
    // Ajouter l'Encounter si des données PV1 sont présentes
    if (pv1Segment) {
      const encounter = {
        fullUrl: `urn:uuid:${encounterId}`,
        resource: {
          resourceType: 'Encounter',
          id: encounterId,
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: pv1Parts[2] === 'I' ? 'IMP' : 'AMB',
            display: pv1Parts[2] === 'I' ? 'inpatient encounter' : 'ambulatory'
          },
          subject: {
            reference: `urn:uuid:${patientId}`
          }
        },
        request: {
          method: 'POST',
          url: 'Encounter'
        }
      };
      
      // Ajouter les dates de début/fin si disponibles
      if (pv1Parts[44]) {
        const startDate = pv1Parts[44].replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
        encounter.resource.period = { start: startDate };
        
        if (pv1Parts[45]) {
          const endDate = pv1Parts[45].replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
          encounter.resource.period.end = endDate;
        }
      }
      
      result.entry.push(encounter);
    }
    
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