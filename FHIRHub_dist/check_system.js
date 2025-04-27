/**
 * Script de vérification des prérequis système pour FHIRHub
 * Vérifie que toutes les dépendances et conditions nécessaires sont remplies
 */

const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.blue}Vérification des prérequis système pour FHIRHub${colors.reset}\n`);

// Tableau pour stocker les résultats
const results = [];

// Vérifier la version de Node.js
const nodeVersion = process.version;
const nodeVersionNum = parseFloat(nodeVersion.slice(1).split('.')[0]);
results.push({
  name: 'Version de Node.js',
  status: nodeVersionNum >= 18 ? 'OK' : 'AVERTISSEMENT',
  current: nodeVersion,
  required: 'v18.x ou supérieur',
  message: nodeVersionNum >= 18 ? null : 'Une version plus récente de Node.js est recommandée'
});

// Vérifier la mémoire disponible
const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10;
const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10;
results.push({
  name: 'Mémoire RAM',
  status: totalMemory >= 2 ? 'OK' : 'ERREUR',
  current: `${totalMemory} Go (${freeMemory} Go libre)`,
  required: '2 Go minimum',
  message: totalMemory < 2 ? 'Mémoire RAM insuffisante pour des performances optimales' : null
});

// Vérifier l'espace disque pour le répertoire actuel
function checkDiskSpace() {
  if (process.platform === 'win32') {
    // Windows
    const drive = path.resolve('./').split(path.sep)[0] + '\\';
    exec(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:csv`, (error, stdout) => {
      if (error) {
        console.error('Erreur lors de la vérification de l\'espace disque:', error);
        return;
      }
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const values = lines[1].split(',');
        if (values.length >= 3) {
          const freeSpace = Math.round(parseInt(values[1]) / (1024 * 1024 * 1024) * 10) / 10;
          const totalSpace = Math.round(parseInt(values[2]) / (1024 * 1024 * 1024) * 10) / 10;
          
          results.push({
            name: 'Espace disque',
            status: freeSpace >= 0.5 ? 'OK' : 'ERREUR',
            current: `${freeSpace} Go libre (sur ${totalSpace} Go)`,
            required: '500 Mo minimum',
            message: freeSpace < 0.5 ? 'Espace disque insuffisant' : null
          });
          
          displayResults();
        }
      }
    });
  } else {
    // Linux/macOS
    exec('df -k .', (error, stdout) => {
      if (error) {
        console.error('Erreur lors de la vérification de l\'espace disque:', error);
        return;
      }
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const values = lines[1].split(/\s+/);
        if (values.length >= 4) {
          const freeSpace = Math.round(parseInt(values[3]) / (1024 * 1024) * 10) / 10;
          const totalSpace = Math.round(parseInt(values[1]) / (1024 * 1024) * 10) / 10;
          
          results.push({
            name: 'Espace disque',
            status: freeSpace >= 0.5 ? 'OK' : 'ERREUR',
            current: `${freeSpace} Go libre (sur ${totalSpace} Go)`,
            required: '500 Mo minimum',
            message: freeSpace < 0.5 ? 'Espace disque insuffisant' : null
          });
          
          displayResults();
        }
      }
    });
  }
}

// Vérifier les répertoires nécessaires
function checkDirectories() {
  const dirs = ['./data', './data/in', './data/out', './data/uploads', './french_terminology', './frontend'];
  dirs.forEach(dir => {
    const exists = fs.existsSync(dir);
    if (!exists) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  results.push({
    name: 'Structure des répertoires',
    status: 'OK',
    current: 'Tous les répertoires nécessaires existent ou ont été créés',
    required: 'Répertoires data/ et french_terminology/',
    message: null
  });
}

// Vérifier la configuration
function checkConfig() {
  const configFile = './config.json';
  const exists = fs.existsSync(configFile);
  
  if (exists) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      const valid = config.server && config.database && config.converter;
      
      results.push({
        name: 'Fichier de configuration',
        status: valid ? 'OK' : 'AVERTISSEMENT',
        current: valid ? 'Fichier valide' : 'Format incorrect',
        required: 'config.json valide',
        message: valid ? null : 'Le fichier de configuration pourrait être incomplet'
      });
    } catch (e) {
      results.push({
        name: 'Fichier de configuration',
        status: 'ERREUR',
        current: 'Fichier invalide (JSON malformé)',
        required: 'config.json valide',
        message: 'Le fichier de configuration contient des erreurs de syntaxe'
      });
    }
  } else {
    results.push({
      name: 'Fichier de configuration',
      status: 'AVERTISSEMENT',
      current: 'Fichier absent',
      required: 'config.json valide',
      message: 'Configuration par défaut sera utilisée'
    });
  }
}

// Afficher les résultats
function displayResults() {
  if (results.length < 5) return; // Attendons d'avoir tous les résultats
  
  console.log(`${colors.bold}Résultats des vérifications :${colors.reset}\n`);
  
  results.forEach(result => {
    const statusColor = result.status === 'OK' ? colors.green : 
                         result.status === 'AVERTISSEMENT' ? colors.yellow : colors.red;
    
    console.log(`${colors.bold}${result.name}${colors.reset}`);
    console.log(`  Status: ${statusColor}${result.status}${colors.reset}`);
    console.log(`  Actuel: ${result.current}`);
    console.log(`  Requis: ${result.required}`);
    if (result.message) {
      console.log(`  ${statusColor}${result.message}${colors.reset}`);
    }
    console.log('');
  });
  
  // Déterminer si le système est compatible
  const hasErrors = results.some(r => r.status === 'ERREUR');
  const hasWarnings = results.some(r => r.status === 'AVERTISSEMENT');
  
  console.log(colors.bold + '----------------------------------------' + colors.reset);
  if (hasErrors) {
    console.log(`${colors.bold}${colors.red}✘ Le système NE SATISFAIT PAS les exigences minimales pour FHIRHub.${colors.reset}`);
    console.log(`${colors.red}  Veuillez corriger les erreurs ci-dessus avant d'installer.${colors.reset}`);
  } else if (hasWarnings) {
    console.log(`${colors.bold}${colors.yellow}⚠ Le système répond aux exigences minimales, mais avec des avertissements.${colors.reset}`);
    console.log(`${colors.yellow}  FHIRHub fonctionnera mais pourrait rencontrer des problèmes de performance.${colors.reset}`);
  } else {
    console.log(`${colors.bold}${colors.green}✓ Le système répond à toutes les exigences pour FHIRHub.${colors.reset}`);
    console.log(`${colors.green}  Vous pouvez procéder à l'installation.${colors.reset}`);
  }
}

// Exécuter les vérifications
checkDirectories();
checkConfig();
checkDiskSpace(); // Cette fonction appellera displayResults() une fois terminée