/**
 * Test de l'accès aux fichiers de terminologie
 * Ce script vérifie si les fichiers de terminologie sont correctement chargés
 * après le nettoyage et la simplification de l'infrastructure.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_ENDPOINT = '/api/terminology/files';
const LOGIN_ENDPOINT = '/api/login';

// Dossier de terminologie
const TERMINOLOGY_DIR = path.join(__dirname, 'french_terminology');

async function login() {
  try {
    const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!response.ok) {
      console.log('Échec de la connexion. Utilisation du mode hors-ligne.');
      return 'temp_offline_token_admin'; // Token hors-ligne comme dans auth-utils.js
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Erreur lors de la connexion:', error.message);
    console.log('Utilisation du mode hors-ligne.');
    return 'temp_offline_token_admin'; // Token hors-ligne
  }
}

async function getTerminologyFiles(token) {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers de terminologie:', error.message);
    return null;
  }
}

async function getFileContent(token, filename) {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINT}/${filename}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erreur lors de la récupération du fichier ${filename}:`, error.message);
    return null;
  }
}

// Vérifier si les fichiers existent localement
function checkLocalFiles() {
  const requiredFiles = [
    'ans_common_codes.json',
    'ans_oids.json',
    'ans_terminology_systems.json'
  ];

  console.log('\n--- Vérification des fichiers locaux ---');
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(TERMINOLOGY_DIR, file);
    const exists = fs.existsSync(filePath);
    
    console.log(`${file}: ${exists ? '✓ Présent' : '✗ Manquant'}`);
    
    if (!exists) {
      allFilesExist = false;
    }
  }

  return allFilesExist;
}

async function main() {
  console.log('=== Test d\'accès aux terminologies ===');
  
  // Vérifier les fichiers locaux
  const filesExist = checkLocalFiles();
  if (!filesExist) {
    console.error('\n❌ Certains fichiers de terminologie sont manquants localement.');
    return;
  }
  
  console.log('\n✅ Tous les fichiers de terminologie sont présents localement.');
  
  // Se connecter et obtenir un token
  console.log('\n--- Connexion au système ---');
  const token = await login();
  console.log(`Token ${token.startsWith('temp_') ? 'hors-ligne' : 'en ligne'} obtenu.`);
  
  // Récupérer la liste des fichiers
  console.log('\n--- Récupération de la liste des fichiers ---');
  const files = await getTerminologyFiles(token);
  
  if (!files || !files.files) {
    console.error('❌ Échec de la récupération des fichiers de terminologie.');
    return;
  }
  
  console.log(`✅ ${files.files.length} fichiers de terminologie trouvés.`);
  
  // Tester l'accès aux fichiers spécifiques
  const testFiles = [
    'ans_common_codes.json',
    'ans_oids.json',
    'ans_terminology_systems.json'
  ];
  
  console.log('\n--- Accès aux fichiers spécifiques ---');
  
  for (const file of testFiles) {
    console.log(`\nTest d'accès à ${file}...`);
    const content = await getFileContent(token, file);
    
    if (content) {
      console.log(`✅ ${file} accessible via l'API.`);
      // Afficher quelques informations sur le fichier
      if (content.metadata) {
        console.log(`  - Description: ${content.metadata.description}`);
        console.log(`  - Version: ${content.metadata.version}`);
        console.log(`  - Dernière mise à jour: ${content.metadata.lastUpdated}`);
      }
    } else {
      console.error(`❌ Échec de l'accès à ${file}.`);
    }
  }
  
  console.log('\n=== Test terminé ===');
}

main().catch(error => {
  console.error('Erreur lors de l\'exécution du test:', error);
});