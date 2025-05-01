/**
 * Script de débogage pour tester l'insertion directe dans la base de données
 * Cela va nous aider à comprendre le problème avec SQLite
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
  deleteStmt.run('test_direct');
  console.log('Suppression du fournisseur de test si existant.');
} catch (error) {
  console.log('Erreur lors de la suppression:', error.message);
}

// Tester l'insertion directe avec différentes approches
try {
  // Approche 1: Valeurs individuelles
  console.log('\nApproche 1: Valeurs individuelles');
  const stmt1 = db.prepare(`
    INSERT INTO ai_providers (
      provider_name, api_key, api_url, models, status, enabled, settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result1 = stmt1.run(
    'test_direct',
    'test-key-1',
    'https://example.com',
    'model1,model2',
    'active',
    1,
    '{"temperature":0.7,"max_tokens":4000}'
  );
  
  console.log('Insertion réussie (Approche 1):', result1);
  
  // Récupérer le fournisseur ajouté
  const provider1 = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(result1.lastInsertRowid);
  console.log('Fournisseur ajouté (Approche 1):', provider1);
  
  // Supprimer pour le prochain test
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(result1.lastInsertRowid);
  
  // Approche 2: Object.values
  console.log('\nApproche 2: Object.values');
  const stmt2 = db.prepare(`
    INSERT INTO ai_providers (
      provider_name, api_key, api_url, models, status, enabled, settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const providerData = {
    provider_name: 'test_direct',
    api_key: 'test-key-2',
    api_url: 'https://example.com',
    models: 'model1,model2',
    status: 'active',
    enabled: 1,
    settings: JSON.stringify({ temperature: 0.7, max_tokens: 4000 })
  };
  
  const result2 = stmt2.run(...Object.values(providerData));
  console.log('Insertion réussie (Approche 2):', result2);
  
  // Récupérer le fournisseur ajouté
  const provider2 = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(result2.lastInsertRowid);
  console.log('Fournisseur ajouté (Approche 2):', provider2);
  
  // Supprimer pour terminer proprement
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(result2.lastInsertRowid);
  
} catch (error) {
  console.error('Erreur lors du test:', error);
} finally {
  // Fermer la connexion
  db.close();
  console.log('\nConnexion à la base de données fermée');
}
