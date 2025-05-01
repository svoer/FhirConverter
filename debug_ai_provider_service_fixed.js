/**
 * Script de débogage pour tester le service aiProviderService
 * avec les corrections nécessaires pour les types de données
 */

const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const dbPath = path.join(__dirname, 'data', 'fhirhub.db');
console.log(`Connexion à la base de données: ${dbPath}`);

// Ouvrir la connexion à la base de données
const db = new Database(dbPath);

// Supprimer le fournisseur de test s'il existe
try {
  const deleteStmt = db.prepare('DELETE FROM ai_providers WHERE provider_name = ?');
  deleteStmt.run('test_service');
  console.log('Suppression du fournisseur de test si existant.');
} catch (error) {
  console.log('Erreur lors de la suppression:', error.message);
}

// Fonction pour convertir les valeurs non supportées par SQLite
function convertToSQLiteValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return value;
}

// Simulation de notre service avec correction des types
function addProvider(providerData) {
  try {
    console.log('Données du fournisseur reçues:', providerData);
    
    // Vérification des données requises
    if (!providerData.provider_name || !providerData.api_key) {
      throw new Error('Le nom du fournisseur et la clé API sont obligatoires');
    }
    
    // Préparation des paramètres avec conversion des types
    const params = [
      convertToSQLiteValue(providerData.provider_name),
      convertToSQLiteValue(providerData.api_key),
      convertToSQLiteValue(providerData.api_url || ''),
      convertToSQLiteValue(providerData.models || ''),
      convertToSQLiteValue(providerData.status || 'active'),
      convertToSQLiteValue(providerData.enabled === undefined ? 1 : providerData.enabled),
      convertToSQLiteValue(providerData.settings || '{}')
    ];
    
    console.log('Paramètres préparés:', params);
    
    // Insertion dans la base de données
    const stmt = db.prepare(`
      INSERT INTO ai_providers (
        provider_name, api_key, api_url, models, status, enabled, settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(...params);
    console.log('Insertion réussie:', result);
    
    // Récupérer le fournisseur ajouté
    const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(result.lastInsertRowid);
    console.log('Fournisseur ajouté:', provider);
    
    return provider;
  } catch (error) {
    console.error('Erreur lors de l\'ajout du fournisseur:', error);
    throw error;
  }
}

// Tester l'ajout d'un fournisseur
try {
  // Test avec un objet settings et un booléen
  console.log('\nTest 1: Avec un objet settings et un booléen');
  const result1 = addProvider({
    provider_name: 'test_service',
    api_key: 'test-key-service',
    api_url: 'https://example.com',
    models: 'model1,model2',
    enabled: true,
    settings: {
      temperature: 0.7,
      max_tokens: 4000
    }
  });
  
  // Supprimer pour le prochain test
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(result1.id);
  
  // Test avec une chaîne settings et un nombre pour enabled
  console.log('\nTest 2: Avec une chaîne settings et un nombre pour enabled');
  const result2 = addProvider({
    provider_name: 'test_service',
    api_key: 'test-key-service',
    api_url: 'https://example.com',
    models: 'model1,model2',
    enabled: 1,
    settings: '{"temperature":0.7,"max_tokens":4000}'
  });
  
  // Nettoyage final
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(result2.id);
  
} catch (error) {
  console.error('Erreur lors du test:', error);
} finally {
  // Fermer la connexion
  db.close();
  console.log('\nConnexion à la base de données fermée');
}
