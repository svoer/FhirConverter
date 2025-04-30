/**
 * Application FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies françaises
 * @author Équipe FHIRHub
 * @version 1.1.0
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { setupSwagger } = require('./swagger');
const documentationRoutes = require('./server/routes/documentation');

// Importer le convertisseur avec cache intégré 
const { convertHL7ToFHIR } = require('./src/cacheEnabledConverter');

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
app.use(bodyParser.text({ limit: '10mb', type: 'text/plain' }));

// Middleware pour parser les trames MLLP
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/mllp' || req.headers['content-type'] === 'application/x-mllp') {
    let data = '';
    req.on('data', chunk => {
      data += chunk.toString();
    });
    req.on('end', () => {
      // Extraire le message entre les caractères de contrôle MLLP
      // VT (0x0B) au début et FS (0x1C) CR (0x0D) à la fin
      const startChar = String.fromCharCode(0x0B); // VT
      const endChar1 = String.fromCharCode(0x1C); // FS
      const endChar2 = String.fromCharCode(0x0D); // CR

      let message = data;
      // Extraire le contenu entre VT et FS CR
      if (message.startsWith(startChar) && message.includes(endChar1)) {
        message = message.substring(1, message.lastIndexOf(endChar1));
      }
      
      req.body = message;
      req.mllpMessage = message;
      next();
    });
  } else {
    next();
  }
});

// Configuration de Swagger
setupSwagger(app);

// Servir les fichiers statiques
app.use(express.static('public'));

// Routes pour la documentation markdown des types de messages
app.use('/docs', documentationRoutes);

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
      api_key_id INTEGER,
      processing_time INTEGER DEFAULT 0,
      resource_count INTEGER DEFAULT 0
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

// REMARQUE: Nous utilisons maintenant le convertisseur avec cache de src/cacheEnabledConverter.js
// qui est importé en haut du fichier

/**
 * @swagger
 * /api/convert:
 *   post:
 *     summary: Convertir un message HL7 v2.5 en FHIR R4 (format JSON)
 *     description: Convertit un message HL7 v2.5 en ressources FHIR R4 (Bundle Transaction) selon les spécifications de l'ANS. Le message doit être envoyé au format JSON.
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
 *
 * /api/convert/raw:
 *   post:
 *     summary: Convertir un message HL7 v2.5 en FHIR R4 (format texte brut)
 *     description: Convertit un message HL7 v2.5 en ressources FHIR R4 (Bundle Transaction) selon les spécifications de l'ANS. Le message doit être envoyé au format texte brut.
 *     tags:
 *       - Conversion
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             description: Message HL7 v2.5 à convertir en texte brut
 *             example: "MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230801101530||ADT^A01|20230801101530|P|2.5|||||FRA|UNICODE UTF-8|||LAB_HL7_V2\nPID|1||458722781^^^CENTRE_HOSPITALIER_DE_TEST^PI||SECLET^MARYSE BERTHE ALICE||19830711|F|||123 AVENUE DES HÔPITAUX^^PARIS^^75001^FRANCE^H||0123456789^PRN^CP~email@test.fr^NET^^|||||78123456789|||||||||^FR-LYON^N"
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
 *       500:
 *         description: Erreur serveur
 *
 * /api/convert/mllp:
 *   post:
 *     summary: Convertir un message HL7 v2.5 en FHIR R4 (format MLLP)
 *     description: Convertit un message HL7 v2.5 encapsulé dans le protocole MLLP en ressources FHIR R4 (Bundle Transaction) selon les spécifications de l'ANS.
 *     tags:
 *       - Conversion
 *     requestBody:
 *       required: true
 *       content:
 *         application/mllp:
 *           schema:
 *             type: string
 *             description: Message HL7 v2.5 au format MLLP (avec caractères de contrôle)
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
 *       500:
 *         description: Erreur serveur
 */
// Importer les middlewares d'authentification
const apiKeyAuth = require('./middleware/apiKeyAuth');
const jwtAuth = require('./middleware/jwtAuth');
const authCombined = require('./middleware/authCombined');

// Fonction commune pour traiter les conversions HL7 vers FHIR
function processHL7Conversion(hl7Message, res) {
  if (!hl7Message) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le message HL7 est requis'
    });
  }
  
  console.log('[API] Démarrage de la conversion HL7 vers FHIR');
  
  try {
    // Utiliser le convertisseur avec cache pour transformer HL7 en FHIR
    const startTime = Date.now();
    const result = convertHL7ToFHIR(hl7Message);
    const conversionTime = Date.now() - startTime;
    const fromCache = result._meta && result._meta.fromCache;
    
    console.log(`[API] Conversion terminée en ${conversionTime}ms avec ${result.entry.length} ressources générées${fromCache ? ' (depuis le cache)' : ''}`);
    
    // Enregistrement de la conversion
    db.prepare(`
      INSERT INTO conversion_logs (
        input_message,
        output_message,
        status,
        timestamp,
        processing_time,
        resource_count
      ) VALUES (?, ?, ?, datetime('now'), ?, ?)
    `).run(
      hl7Message.length > 1000 ? hl7Message.substring(0, 1000) + '...' : hl7Message,
      JSON.stringify(result).length > 1000 ? JSON.stringify(result).substring(0, 1000) + '...' : JSON.stringify(result),
      'success',
      conversionTime,
      result.entry ? result.entry.length : 0
    );
    
    // Nettoyer les métadonnées internes avant de retourner le résultat
    if (result._meta) {
      delete result._meta;
    }
    
    return res.status(200).json({
      success: true,
      data: result,
      meta: {
        conversionTime: conversionTime,
        resourceCount: result.entry.length,
        fromCache: fromCache || false
      }
    });
  } catch (error) {
    console.error('[CONVERSION ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Conversion Error',
      message: error.message || 'Erreur inconnue'
    });
  }
}

// 1. Endpoint JSON qui accepte un message HL7 encapsulé dans un champ JSON
app.post('/api/convert', authCombined, (req, res) => {
  const { hl7Message } = req.body;
  return processHL7Conversion(hl7Message, res);
});

// 2. Endpoint pour texte brut qui accepte directement le message HL7
app.post('/api/convert/raw', authCombined, (req, res) => {
  const hl7Message = req.body; // req.body contient directement le texte (grâce à bodyParser.text())
  return processHL7Conversion(hl7Message, res);
});

// 3. Endpoint pour MLLP (Minimal Lower Layer Protocol)
app.post('/api/convert/mllp', authCombined, (req, res) => {
  const hl7Message = req.mllpMessage; // Obtenu via le middleware MLLP
  if (!hl7Message) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Message MLLP invalide'
    });
  }
  return processHL7Conversion(hl7Message, res);
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
app.post('/api/convert/validate', authCombined, (req, res) => {
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
 
/**
 * @swagger
 * /api/terminology/french:
 *   get:
 *     summary: Obtenir les informations sur les terminologies françaises
 *     description: Retourne les informations sur les systèmes de terminologie français utilisés pour la conversion
 *     tags:
 *       - Terminologie
 *     responses:
 *       200:
 *         description: Informations récupérées avec succès
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
 *                     version:
 *                       type: string
 *                       description: Version des mappings de terminologies françaises
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       description: Date de dernière mise à jour des mappings
 *                     systems:
 *                       type: object
 *                       description: Systèmes de terminologie français disponibles
 *                     oids:
 *                       type: object
 *                       description: OIDs français disponibles
 *       500:
 *         description: Erreur serveur
 */
app.get('/api/stats', (req, res) => {
  try {
    const conversionCount = db.prepare('SELECT COUNT(*) as count FROM conversion_logs').get();
    
    // Récupérer les statistiques de temps de conversion
    const conversionStats = db.prepare(`
      SELECT 
        AVG(processing_time) as avg_time,
        MIN(processing_time) as min_time,
        MAX(processing_time) as max_time,
        AVG(resource_count) as avg_resources
      FROM conversion_logs
      WHERE processing_time > 0
    `).get();
    
    // Récupérer le dernier temps de conversion
    const lastConversion = db.prepare(`
      SELECT processing_time, resource_count
      FROM conversion_logs
      WHERE processing_time > 0
      ORDER BY timestamp DESC
      LIMIT 1
    `).get();
    
    res.json({
      success: true,
      data: {
        conversions: conversionCount.count,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        conversionStats: {
          avgTime: conversionStats ? Math.round(conversionStats.avg_time || 0) : 0,
          minTime: conversionStats ? conversionStats.min_time || 0 : 0,
          maxTime: conversionStats ? conversionStats.max_time || 0 : 0,
          avgResources: conversionStats ? Math.round(conversionStats.avg_resources || 0) : 0,
          lastTime: lastConversion ? lastConversion.processing_time : 0,
          lastResources: lastConversion ? lastConversion.resource_count : 0
        }
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

// Initialiser la base de données
initDb();

// Partager la connexion à la base de données avec les routes
app.locals.db = db;

// Importation des routes
const applicationsRoutes = require('./routes/applications');
const apiKeysRoutes = require('./routes/api-keys');
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const devApiRoutes = require('./routes/dev-api');
const cacheRoutes = require('./routes/cache');

// Enregistrement des routes
app.use('/api/applications', applicationsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dev', devApiRoutes);

/**
 * Route pour obtenir les informations sur les terminologies françaises
 */
app.get('/api/terminology/french', authCombined, (req, res) => {
  try {
    const terminologyData = {
      version: fhirHub.getTerminologyVersion(),
      lastUpdated: require('./data/french_terminology_mappings.json').lastUpdated,
      systems: fhirHub.frenchTerminology.FRENCH_SYSTEMS,
      oids: fhirHub.frenchTerminology.FRENCH_OIDS
    };
    
    res.json({
      success: true,
      data: terminologyData
    });
  } catch (error) {
    console.error('[TERMINOLOGY ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Terminology Error',
      message: error.message || 'Erreur inconnue'
    });
  }
});

// Démarrage du serveur avec gestion d'erreur pour le port déjà utilisé
const server = app.listen(PORT, () => {
  console.log(`[SERVER] FHIRHub démarré sur le port ${PORT}`);
});

// Gestion des erreurs de démarrage du serveur
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[SERVER ERROR] Le port ${PORT} est déjà utilisé par une autre application. Essayez de modifier la variable PORT dans le fichier .env ou d'arrêter l'application qui utilise ce port.`);
    process.exit(1);
  } else {
    console.error('[SERVER ERROR]', error);
    process.exit(1);
  }
});