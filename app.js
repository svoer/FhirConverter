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

// Définition du chemin de la base de données
let DB_PATH = './data/fhirhub.db';

// Vérification des permissions
try {
  // Création du fichier s'il n'existe pas
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '', { mode: 0o666 });
    console.log('Fichier de base de données créé');
  }
  
  // S'assurer que le fichier est accessible en écriture
  fs.accessSync(DB_PATH, fs.constants.W_OK);
  console.log('Permissions d\'écriture vérifiées pour la base de données');
} catch (error) {
  console.error('Erreur de permission sur la base de données:', error);
  // Si erreur de permission, utiliser un chemin alternatif dans /tmp
  console.log('Utilisation d\'un chemin alternatif pour la base de données');
  const DB_PATH_ALT = '/tmp/fhirhub.db';
  
  if (fs.existsSync(DB_PATH) && !fs.existsSync(DB_PATH_ALT)) {
    // Copier la base de données existante vers /tmp
    try {
      fs.copyFileSync(DB_PATH, DB_PATH_ALT);
      console.log('Base de données copiée vers', DB_PATH_ALT);
    } catch (copyError) {
      console.error('Erreur lors de la copie de la base de données:', copyError);
    }
  }
  DB_PATH = DB_PATH_ALT;
}

// Ouvrir la base de données avec les options appropriées
const db = new Database(DB_PATH, { fileMustExist: false, verbose: console.log });

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
    
    // Vérifier si toutes les tables requises existent déjà
    const allTablesExist = ['conversion_logs', 'users', 'applications', 'api_keys'].every(
      table => existingTables.includes(table)
    );
    
    // Si toutes les tables existent déjà, ne pas les réinitialiser
    if (allTablesExist) {
      console.log('[DB] Toutes les tables existent déjà, utilisation de la base de données existante.');
      return; // Sortir de la fonction pour éviter de réinitialiser la base de données
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

// Nous devons toujours importer le module fhirHub pour accéder aux terminologies françaises
const fhirHub = require('./src/index');

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

// Initialisation du service de workflow
const workflowService = require('./src/services/workflowService');
workflowService.initialize().catch(err => {
  console.error('[WORKFLOW ERROR] Erreur lors de l\'initialisation du service de workflow:', err);
});

// Partager la connexion à la base de données avec les routes
app.locals.db = db;

// Importation des routes
const applicationsRoutes = require('./routes/applications');
const apiKeysRoutes = require('./routes/api-keys');
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const devApiRoutes = require('./routes/dev-api');
const cacheRoutes = require('./routes/cache');
const terminologyRoutes = require('./routes/terminology');
const aiProvidersRoutes = require('./routes/ai-providers');
const aiChatRoutes = require('./routes/ai-chat');
const workflowsRoutes = require('./routes/workflows');

// Enregistrement des routes
app.use('/api/applications', applicationsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dev', devApiRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/terminology', terminologyRoutes);
app.use('/api/ai-providers', aiProvidersRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/workflows', workflowsRoutes);

// Intégrer l'éditeur Node-RED
const redApp = workflowService.getRedApp();
if (redApp) {
  // Route spéciale pour l'éditeur Node-RED avec authentification JWT
  app.use('/node-red', (req, res, next) => {
    // Récupérer le token JWT des paramètres d'URL ou des en-têtes
    const token = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    
    // Ou utiliser la clé API
    const apiKey = req.query.apiKey || req.headers['x-api-key'];
    
    console.log('[WORKFLOW] Tentative d\'accès à Node-RED - Token:', !!token, 'API Key:', !!apiKey);
    
    if (apiKey === 'dev-key') {
      // Si la clé API est la clé de développement, permettre l'accès
      console.log('[WORKFLOW] Accès à Node-RED autorisé avec clé API de développement');
      return redApp(req, res, next);
    } else if (token) {
      // Vérifier le token JWT
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log('[WORKFLOW] Token JWT décodé:', decoded);
        
        // Plusieurs manières possibles de stocker le rôle dans le token
        const isAdmin = 
          decoded.role === 'admin' || 
          (Array.isArray(decoded.roles) && decoded.roles.includes('admin')) ||
          decoded.isAdmin === true;
        
        if (isAdmin) {
          console.log('[WORKFLOW] Accès à Node-RED autorisé pour un administrateur');
          return redApp(req, res, next);
        } else {
          console.log('[WORKFLOW] Rôle non administrateur détecté:', decoded.role || decoded.roles);
        }
      } catch (error) {
        console.error('[WORKFLOW] Erreur de vérification du token JWT:', error.message);
      }
    }
    
    // Si le token est invalide ou manquant
    if (req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized', 
        message: 'Accès non autorisé à Node-RED'
      });
    } else {
      // Rediriger vers la page de connexion
      return res.redirect('/login.html');
    }
  });
  console.log('[WORKFLOW] Éditeur Node-RED intégré à l\'application avec protection d\'authentification');
} else {
  console.warn('[WORKFLOW] Éditeur Node-RED non disponible');
}

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