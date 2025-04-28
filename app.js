/**
 * Application FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies françaises
 * @author Équipe FHIRHub
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { setupSwagger } = require('./swagger');

/**
 * Configuration de l'application
 */
const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Configuration des middlewares
 */
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Configuration de Swagger
setupSwagger(app);

// Servir les fichiers statiques
app.use(express.static('public'));

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
  
  try {
    // Vérifier si les tables nécessaires existent
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('conversion_logs', 'users', 'applications', 'api_keys')
    `).all();
    
    const existingTables = tables.map(t => t.name);
    
    // Supprimer les tables existantes pour éviter les problèmes de schéma
    if (existingTables.length > 0) {
      // Désactiver les contraintes de clé étrangère temporairement
      db.exec('PRAGMA foreign_keys = OFF;');
      
      // Supprimer les tables dans l'ordre inverse des dépendances
      if (existingTables.includes('api_keys')) {
        db.exec('DROP TABLE api_keys');
      }
      if (existingTables.includes('applications')) {
        db.exec('DROP TABLE applications');
      }
      if (existingTables.includes('users')) {
        db.exec('DROP TABLE users');
      }
      if (existingTables.includes('conversion_logs')) {
        db.exec('DROP TABLE conversion_logs');
      }
      
      // Réactiver les contraintes de clé étrangère
      db.exec('PRAGMA foreign_keys = ON;');
      
      console.log('[DB] Tables existantes supprimées pour recréation');
    }
    
    // Créer toutes les tables nécessaires
    // Table des logs de conversion
    db.exec(`CREATE TABLE IF NOT EXISTS conversion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_message TEXT NOT NULL,
      output_message TEXT,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      api_key_id INTEGER
    )`);
    
    // Table des utilisateurs
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    
    // Table des applications
    db.exec(`CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cors_origins TEXT,
      settings TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by INTEGER,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`);
    
    // Table des clés API
    db.exec(`CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      key TEXT UNIQUE NOT NULL,
      hashed_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(id)
    )`);
    
    // Créer l'utilisateur admin avec le mot de passe par défaut
    db.prepare(`
      INSERT INTO users (username, password, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run('admin', hashPassword('adminfhirhub'), 'admin');
    
    console.log('[DB] Utilisateur admin créé avec le mot de passe par défaut');
    
    // Récupérer l'ID de l'admin
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    
    // Créer l'application par défaut
    const appId = db.prepare(`
      INSERT INTO applications (
        name, description, settings, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
    `).run(
      'Default',
      'Application par défaut pour le développement',
      JSON.stringify({
        max_conversions_per_day: 1000,
        max_message_size: 100000
      }),
      adminId
    ).lastInsertRowid;
    
    // Créer une clé API de développement
    db.prepare(`
      INSERT INTO api_keys (
        application_id, key, hashed_key, description, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      appId,
      'dev-key',
      hashValue('dev-key'),
      'Clé de développement'
    );
    
    console.log('[DB] Application par défaut et clé API de développement créées');
    console.log('Base de données initialisée avec succès.');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
  }
}

// Fonction pour générer une clé API
function generateApiKey() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// Fonction pour hacher un mot de passe
function hashPassword(password) {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Fonction pour vérifier un mot de passe
function verifyPassword(storedPassword, suppliedPassword) {
  const crypto = require('crypto');
  const [salt, hash] = storedPassword.split(':');
  const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
  return hash === suppliedHash;
}

// Fonction pour hacher une valeur (pour les clés API)
function hashValue(value) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Route de base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

/**
 * @swagger
 * /api/convert:
 *   post:
 *     summary: Convertir un message HL7 v2.5 en FHIR R4
 *     description: Convertit un message HL7 v2.5 en ressources FHIR R4 (Bundle Transaction)
 *     tags:
 *       - Conversion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hl7Message
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 v2.5 à convertir
 *                 example: "MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230801101530||ADT^A01|20230801101530|P|2.5|||||FRA|UNICODE UTF-8|||LAB_HL7_V2\nPID|1||458722781^^^CENTRE_HOSPITALIER_DE_TEST^PI||SECLET^MARYSE BERTHE ALICE||19830711|F|||123 AVENUE DES HÔPITAUX^^PARIS^^75001^FRANCE^H||0123456789^PRN^CP~email@test.fr^NET^^|||||78123456789|||||||||^FR-LYON^N"
 *     responses:
 *       200:
 *         description: Conversion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Bundle FHIR R4 contenant les ressources converties
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Bad Request
 *                 message:
 *                   type: string
 *                   example: Le message HL7 est requis
 *       500:
 *         description: Erreur serveur
 */
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

/**
 * @swagger
 * /api/convert/validate:
 *   post:
 *     summary: Valider un message HL7 v2.5
 *     description: Vérifie la syntaxe d'un message HL7 v2.5 et retourne des informations sur les segments
 *     tags:
 *       - Conversion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hl7Message
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 v2.5 à valider
 *     responses:
 *       200:
 *         description: Validation réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     segmentCount:
 *                       type: integer
 *                     segmentTypes:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
app.post('/api/convert/validate', (req, res) => {
  try {
    const { hl7Message } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    // Valider le message HL7
    const segments = hl7Message.replace(/\n/g, '\r').split('\r').filter(Boolean);
    
    if (segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 ne contient aucun segment'
      });
    }
    
    if (!segments[0].startsWith('MSH|')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 doit commencer par un segment MSH'
      });
    }
    
    // Compter les segments par type
    const segmentTypes = {};
    
    segments.forEach(segment => {
      const type = segment.split('|')[0] || 'UNKNOWN';
      segmentTypes[type] = (segmentTypes[type] || 0) + 1;
    });
    
    console.log('[HL7 Validation] Message parsé avec succès:', segments.length, 'segments');
    
    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        segmentCount: segments.length,
        segmentTypes
      }
    });
  } catch (error) {
    console.error('[VALIDATION ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Validation Error',
      message: error.message || 'Erreur inconnue'
    });
  }
});

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Obtenir les statistiques du système
 *     description: Retourne les statistiques de conversion et les informations du système
 *     tags:
 *       - Système
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversions:
 *                       type: integer
 *                       description: Nombre total de conversions effectuées
 *                     uptime:
 *                       type: number
 *                       format: float
 *                       description: Temps de fonctionnement du serveur en secondes
 *                     memory:
 *                       type: object
 *                       description: Informations sur la mémoire utilisée
 *       500:
 *         description: Erreur serveur
 */
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