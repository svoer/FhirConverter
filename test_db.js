const path = require('path');
const Database = require('better-sqlite3');

// Chemin vers la base de données
const dbPath = path.join(__dirname, 'data', 'fhirhub.db');
console.log(`Connexion à la base de données: ${dbPath}`);

// Se connecter à la base de données
const db = new Database(dbPath);

// Vérifier si la table existe
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get('ai_providers');
console.log('Table exists:', tableExists);

if (tableExists) {
  try {
    // Tester l'insertion directe d'un fournisseur d'IA
    const settings = JSON.stringify({ temperature: 0.7, max_tokens: 4000 });
    
    // Vérifier si le fournisseur existe déjà
    const existingProvider = db.prepare('SELECT * FROM ai_providers WHERE provider_name = ?').get('test_provider');
    
    if (existingProvider) {
      console.log('Le fournisseur existe déjà:', existingProvider);
      
      // Supprimer le fournisseur pour le test
      const deleteResult = db.prepare('DELETE FROM ai_providers WHERE provider_name = ?').run('test_provider');
      console.log('Fournisseur supprimé:', deleteResult);
    }
    
    // Insérer le fournisseur
    const insertResult = db.prepare(`
      INSERT INTO ai_providers (
        provider_name, api_key, api_url, models, status, enabled, settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test_provider', 
      'test-key',
      'https://example.com',
      'model1,model2',
      'active',
      1,
      settings
    );
    
    console.log('Insertion réussie, ID:', insertResult.lastInsertRowid);
    
    // Récupérer le fournisseur ajouté
    const newProvider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(insertResult.lastInsertRowid);
    console.log('Fournisseur ajouté:', newProvider);
    
    // Afficher les paramètres
    console.log('Settings (raw):', newProvider.settings);
    console.log('Settings (parsed):', JSON.parse(newProvider.settings));
  } catch (error) {
    console.error('Erreur lors du test:', error);
  }
}

// Fermer la connexion
db.close();
