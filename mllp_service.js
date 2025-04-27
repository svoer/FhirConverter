/**
 * Service MLLP (Minimal Lower Layer Protocol) pour FHIRHub
 * Permet de recevoir des messages HL7 v2.x via le protocole MLLP
 * et de les convertir en FHIR
 */

const mllp = require('mllp-node');
const hl7Parser = require('./hl7_parser');
const hl7ToFhirConverter = require('./hl7ToFhirConverter');
const frenchTerminologyAdapter = require('./french_terminology_adapter');
const fhirCleaner = require('./fhir_cleaner');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Répertoire pour stocker les messages reçus
const HL7_DIR = path.join(__dirname, 'data', 'hl7');
const FHIR_DIR = path.join(__dirname, 'data', 'fhir');

// Garantir que les répertoires existent
if (!fs.existsSync(HL7_DIR)) {
  fs.mkdirSync(HL7_DIR, { recursive: true });
}
if (!fs.existsSync(FHIR_DIR)) {
  fs.mkdirSync(FHIR_DIR, { recursive: true });
}

// Configuration par défaut du serveur MLLP
const DEFAULT_CONFIG = {
  port: 6661,                // Port standard pour MLLP
  host: '0.0.0.0',           // Écouter sur toutes les interfaces
  maxConnections: 10,        // Nombre maximum de connexions simultanées
  convertToFHIR: true,       // Convertir automatiquement les messages reçus en FHIR
  saveMessages: true,        // Enregistrer les messages reçus
  validateTerminology: true, // Valider la terminologie française
  cleanFHIR: true,           // Nettoyer les ressources FHIR pour conformité
  logLevel: 'info'           // Niveau de journalisation (debug, info, warn, error)
};

let serverInstance = null;
let serverConfig = { ...DEFAULT_CONFIG };
let conversionCallbacks = [];

/**
 * Configuration du service MLLP
 * @param {Object} config - Configuration du service
 */
function configure(config = {}) {
  serverConfig = { ...serverConfig, ...config };
  console.log(`[MLLP] Configuration mise à jour: port=${serverConfig.port}`);
  return serverConfig;
}

/**
 * Démarrer le serveur MLLP
 * @returns {Promise<Object>} Information sur le serveur démarré
 */
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      if (serverInstance) {
        console.log('[MLLP] Le serveur est déjà en cours d\'exécution');
        return resolve({
          status: 'running',
          port: serverConfig.port,
          host: serverConfig.host
        });
      }
      
      // Créer le serveur MLLP
      serverInstance = mllp.createServer((receivedData) => {
        handleReceivedMessage(receivedData.toString());
        
        // MLLP requiert une réponse de type ACK
        return generateAcknowledgment(receivedData.toString());
      });
      
      // Démarrer le serveur
      serverInstance.listen(serverConfig.port, serverConfig.host, () => {
        console.log(`[MLLP] Serveur démarré sur ${serverConfig.host}:${serverConfig.port}`);
        resolve({
          status: 'started',
          port: serverConfig.port,
          host: serverConfig.host
        });
      });
      
      // Gérer les erreurs
      serverInstance.on('error', (error) => {
        console.error('[MLLP] Erreur du serveur:', error);
        reject(error);
      });
      
    } catch (error) {
      console.error('[MLLP] Erreur lors du démarrage du serveur:', error);
      reject(error);
    }
  });
}

/**
 * Arrêter le serveur MLLP
 * @returns {Promise<Object>} Statut de l'arrêt
 */
function stopServer() {
  return new Promise((resolve, reject) => {
    if (!serverInstance) {
      console.log('[MLLP] Le serveur n\'est pas en cours d\'exécution');
      return resolve({ status: 'not_running' });
    }
    
    serverInstance.close((error) => {
      if (error) {
        console.error('[MLLP] Erreur lors de l\'arrêt du serveur:', error);
        return reject(error);
      }
      
      serverInstance = null;
      console.log('[MLLP] Serveur arrêté');
      resolve({ status: 'stopped' });
    });
  });
}

/**
 * Vérifier l'état du serveur MLLP
 * @returns {Object} État du serveur
 */
function getServerStatus() {
  return {
    running: !!serverInstance,
    config: serverConfig
  };
}

/**
 * Traiter un message HL7 reçu via MLLP
 * @param {string} messageContent - Contenu du message HL7
 * @returns {Promise<Object>} Résultat du traitement
 */
async function handleReceivedMessage(messageContent) {
  try {
    console.log(`[MLLP] Message reçu (${messageContent.length} caractères)`);
    
    // 1. Enregistrer le message HL7 reçu
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const hl7Filename = `${timestamp}_${messageId}.hl7`;
    const hl7FilePath = path.join(HL7_DIR, hl7Filename);
    
    if (serverConfig.saveMessages) {
      await fs.promises.writeFile(hl7FilePath, messageContent);
      console.log(`[MLLP] Message enregistré: ${hl7FilePath}`);
    }
    
    // 2. Parser le message HL7
    const parsedMessage = hl7Parser.processHL7Content(messageContent);
    
    if (!parsedMessage.success) {
      console.error('[MLLP] Erreur lors du parsing du message:', parsedMessage.message);
      notifyConversionCallbacks({
        success: false,
        source: 'mllp',
        error: parsedMessage.message,
        originalMessage: messageContent,
        timestamp: new Date().toISOString()
      });
      return {
        success: false,
        error: parsedMessage.message
      };
    }
    
    // 3. Convertir en FHIR si demandé
    if (serverConfig.convertToFHIR) {
      // Conversion HL7 vers FHIR
      const conversionResult = await hl7ToFhirConverter.convertHL7ToFHIR(parsedMessage.data);
      
      if (!conversionResult.success) {
        console.error('[MLLP] Erreur lors de la conversion en FHIR:', conversionResult.error);
        notifyConversionCallbacks({
          success: false,
          source: 'mllp',
          error: conversionResult.error,
          originalMessage: messageContent,
          timestamp: new Date().toISOString()
        });
        return {
          success: false,
          error: conversionResult.error
        };
      }
      
      let fhirBundle = conversionResult.fhirBundle;
      
      // 4. Adapter la terminologie française si demandé
      if (serverConfig.validateTerminology) {
        try {
          fhirBundle = frenchTerminologyAdapter.adaptFhirBundle(fhirBundle);
          console.log('[MLLP] Terminologie française adaptée');
        } catch (error) {
          console.warn('[MLLP] Avertissement lors de l\'adaptation de la terminologie:', error.message);
        }
      }
      
      // 5. Nettoyer le bundle FHIR si demandé
      if (serverConfig.cleanFHIR) {
        try {
          fhirBundle = fhirCleaner.cleanBundle(fhirBundle);
          console.log('[MLLP] Bundle FHIR nettoyé');
        } catch (error) {
          console.warn('[MLLP] Avertissement lors du nettoyage du bundle:', error.message);
        }
      }
      
      // 6. Enregistrer le bundle FHIR
      const fhirFilename = `${timestamp}_${messageId}.json`;
      const fhirFilePath = path.join(FHIR_DIR, fhirFilename);
      
      if (serverConfig.saveMessages) {
        await fs.promises.writeFile(fhirFilePath, JSON.stringify(fhirBundle, null, 2));
        console.log(`[MLLP] Bundle FHIR enregistré: ${fhirFilePath}`);
      }
      
      // 7. Notifier les callbacks de conversion
      notifyConversionCallbacks({
        success: true,
        source: 'mllp',
        messageId,
        hl7Filename,
        fhirFilename,
        messageInfo: parsedMessage.data.messageInfo,
        patientInfo: parsedMessage.patientInfo,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        messageId,
        hl7Filename,
        fhirFilename
      };
    }
    
    // Si pas de conversion, simplement notifier la réception
    notifyConversionCallbacks({
      success: true,
      source: 'mllp',
      messageId,
      hl7Filename,
      messageInfo: parsedMessage.data.messageInfo,
      patientInfo: parsedMessage.patientInfo,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      messageId,
      hl7Filename
    };
    
  } catch (error) {
    console.error('[MLLP] Erreur lors du traitement du message:', error);
    
    notifyConversionCallbacks({
      success: false,
      source: 'mllp',
      error: error.message,
      originalMessage: messageContent,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Générer un message ACK (Acknowledgment) en réponse à un message HL7
 * @param {string} originalMessage - Message HL7 original
 * @returns {string} Message ACK au format HL7
 */
function generateAcknowledgment(originalMessage) {
  try {
    // Parser le message original pour extraire les informations nécessaires
    const parsedMessage = hl7Parser.parseHL7Message(originalMessage);
    
    if (!parsedMessage.success) {
      console.error('[MLLP] Erreur lors du parsing pour ACK:', parsedMessage.message);
      // Génération d'un ACK générique en cas d'erreur
      return 'MSH|^~\\&|FHIRHUB|FHIRHUB|SENDING_APP|SENDING_FACILITY|' +
             new Date().toISOString().replace(/[:-]/g, '').substring(0, 14) +
             '||ACK|' + Date.now() + '|P|2.5.1\r' +
             'MSA|AE|UNKNOWN|Erreur de parsing du message\r';
    }
    
    // Extraire les informations nécessaires pour l'ACK
    const data = parsedMessage.data;
    const messageInfo = data.messageInfo;
    const sendingApp = messageInfo.sendingApplication || 'UNKNOWN';
    const sendingFacility = messageInfo.sendingFacility || 'UNKNOWN';
    const messageControlId = messageInfo.messageControlId || 'UNKNOWN';
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').substring(0, 14);
    const version = messageInfo.version || '2.5.1';
    
    // Construire le message ACK
    const ack = `MSH|^~\\&|FHIRHUB|FHIRHUB|${sendingApp}|${sendingFacility}|${timestamp}||ACK|${Date.now()}|P|${version}\r` +
                `MSA|AA|${messageControlId}|Message reçu et traité\r`;
    
    return ack;
  } catch (error) {
    console.error('[MLLP] Erreur lors de la génération de l\'ACK:', error);
    
    // ACK générique en cas d'erreur
    return 'MSH|^~\\&|FHIRHUB|FHIRHUB|SENDING_APP|SENDING_FACILITY|' +
           new Date().toISOString().replace(/[:-]/g, '').substring(0, 14) +
           '||ACK|' + Date.now() + '|P|2.5.1\r' +
           'MSA|AE|UNKNOWN|Erreur interne lors de la génération de l\'ACK\r';
  }
}

/**
 * Enregistrer un callback pour les conversions
 * @param {Function} callback - Fonction à appeler après une conversion
 */
function registerConversionCallback(callback) {
  if (typeof callback === 'function') {
    conversionCallbacks.push(callback);
    console.log('[MLLP] Nouveau callback de conversion enregistré');
    return true;
  }
  return false;
}

/**
 * Notifier tous les callbacks enregistrés
 * @param {Object} data - Données de la conversion
 */
function notifyConversionCallbacks(data) {
  conversionCallbacks.forEach(callback => {
    try {
      callback(data);
    } catch (error) {
      console.error('[MLLP] Erreur dans un callback de conversion:', error);
    }
  });
}

/**
 * Envoyer un message HL7 à un serveur MLLP distant
 * @param {string} host - Hôte du serveur MLLP
 * @param {number} port - Port du serveur MLLP
 * @param {string} message - Message HL7 à envoyer
 * @returns {Promise<Object>} Résultat de l'envoi
 */
function sendMessage(host, port, message) {
  return new Promise((resolve, reject) => {
    try {
      const client = mllp.createClient(host, port);
      
      client.send(message, (error, response) => {
        client.close();
        
        if (error) {
          console.error('[MLLP] Erreur lors de l\'envoi du message:', error);
          return reject(error);
        }
        
        console.log('[MLLP] Message envoyé, réponse reçue');
        resolve({
          success: true,
          response: response.toString()
        });
      });
    } catch (error) {
      console.error('[MLLP] Erreur lors de la création du client MLLP:', error);
      reject(error);
    }
  });
}

// Exporter les fonctions
module.exports = {
  configure,
  startServer,
  stopServer,
  getServerStatus,
  handleReceivedMessage,
  registerConversionCallback,
  sendMessage
};