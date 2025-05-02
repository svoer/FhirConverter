/**
 * Module de journalisation pour FHIRHub
 * Fournit des fonctions pour enregistrer des messages de différents niveaux de gravité
 */

const fs = require('fs');
const path = require('path');

// Créer le répertoire de logs s'il n'existe pas
const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Fichier de log pour les différentes gravités
const LOG_FILE = path.join(LOG_DIR, 'fhirhub.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

/**
 * Écrit un message dans le fichier de log
 * @param {string} level Niveau de log (INFO, WARN, ERROR, DEBUG)
 * @param {string} message Message à logger
 */
function writeToLog(level, message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  // Écrire dans le fichier de log principal
  fs.appendFileSync(LOG_FILE, formattedMessage);
  
  // Écrire également dans le fichier d'erreur si c'est une erreur
  if (level === 'ERROR') {
    fs.appendFileSync(ERROR_LOG_FILE, formattedMessage);
  }
  
  // Afficher également dans la console
  if (level === 'ERROR') {
    console.error(`[${level}] ${message}`);
  } else if (level === 'WARN') {
    console.warn(`[${level}] ${message}`);
  } else {
    console.log(`[${level}] ${message}`);
  }
}

/**
 * Log un message de niveau INFO
 * @param {string} message Message à logger
 */
function info(message) {
  writeToLog('INFO', message);
}

/**
 * Log un message de niveau WARN
 * @param {string} message Message à logger
 */
function warn(message) {
  writeToLog('WARN', message);
}

/**
 * Log un message de niveau ERROR
 * @param {string} message Message à logger
 */
function error(message) {
  writeToLog('ERROR', message);
}

/**
 * Log un message de niveau DEBUG
 * @param {string} message Message à logger
 */
function debug(message) {
  // Ne logger en mode debug que si l'environnement n'est pas en production
  if (process.env.NODE_ENV !== 'production') {
    writeToLog('DEBUG', message);
  }
}

module.exports = {
  info,
  warn,
  error,
  debug
};