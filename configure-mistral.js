/**
 * Script direct pour configurer Mistral AI comme fournisseur actif dans FHIRHub
 * 
 * Utilise directement la base de données SQLite pour insérer ou mettre à jour la configuration.
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Charger les variables d'environnement
dotenv.config();

// Récupérer la clé API Mistral de l'environnement
const mistralApiKey = process.env.MISTRAL_API_KEY || 'VNjTxMwJ1UwOpQBDERIAwdWKK4LHsCXd';

// Chemin standardisé vers la base de données
const DB_PATH = process.env.DB_PATH || './storage/db/fhirhub.db';

console.log(`[SETUP] Configuration du fournisseur Mistral AI...`);
console.log(`[SETUP] Utilisation de la clé API: ${mistralApiKey.substring(0, 4)}...${mistralApiKey.substring(mistralApiKey.length - 4)}`);
console.log(`[SETUP] Connexion à la base de données: ${DB_PATH}`);

// Vérifier que le fichier de base de données existe
if (!fs.existsSync(DB_PATH)) {
  console.error(`[ERREUR] Fichier de base de données non trouvé: ${DB_PATH}`);
  console.error(`[ERREUR] Assurez-vous que le serveur a été démarré au moins une fois.`);
  process.exit(1);
}

// Ouvrir la connexion à la base de données
const db = new sqlite3(DB_PATH, { fileMustExist: true });
console.log('[SETUP] Connexion à la base de données établie');

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

try {
  // Vérifier si le fournisseur Mistral existe déjà
  const existingProvider = db.prepare('SELECT id FROM ai_providers WHERE provider_name = ?')
    .get('Mistral AI');

  if (existingProvider) {
    // Mise à jour du fournisseur existant
    console.log(`[SETUP] Fournisseur Mistral AI existant trouvé avec ID: ${existingProvider.id}, mise à jour...`);
    
    db.prepare(`
      UPDATE ai_providers 
      SET api_key = ?, api_url = ?, models = ?, status = ?, enabled = 1, 
      updated_at = CURRENT_TIMESTAMP, settings = ? 
      WHERE provider_name = ?
    `).run(
      mistralApiKey,
      'https://api.mistral.ai/v1',
      JSON.stringify(['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large-latest']),
      'active',
      JSON.stringify({
        default_model: 'mistral-medium',
        timeout: 60000,
        temperature: 0.7,
        streaming: false
      }),
      'Mistral AI'
    );
    
    console.log(`[SETUP] Fournisseur Mistral AI mis à jour avec succès (ID: ${existingProvider.id})`);
  } else {
    // Création d'un nouveau fournisseur
    console.log('[SETUP] Aucun fournisseur Mistral AI trouvé, création...');
    
    const result = db.prepare(`
      INSERT INTO ai_providers 
      (provider_name, api_key, api_url, models, status, enabled, settings) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Mistral AI',
      mistralApiKey,
      'https://api.mistral.ai/v1',
      JSON.stringify(['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large-latest']),
      'active',
      1,
      JSON.stringify({
        default_model: 'mistral-medium',
        timeout: 60000,
        temperature: 0.7,
        streaming: false
      })
    );
    
    console.log(`[SETUP] Fournisseur Mistral AI créé avec succès (ID: ${result.lastInsertRowid})`);
  }
  
  // Vérifier que le fournisseur est bien configuré
  const provider = db.prepare('SELECT id, provider_name, status, enabled FROM ai_providers WHERE provider_name = ?')
    .get('Mistral AI');
  
  if (provider) {
    console.log(`[SETUP] Configuration réussie:`);
    console.log(`  - ID: ${provider.id}`);
    console.log(`  - Nom: ${provider.provider_name}`);
    console.log(`  - Statut: ${provider.status}`);
    console.log(`  - Activé: ${provider.enabled ? 'Oui' : 'Non'}`);
    console.log(`[SETUP] L'IA est maintenant configurée et prête à utiliser. Redémarrez le serveur pour appliquer les changements.`);
  } else {
    console.error(`[ERREUR] Impossible de vérifier la configuration.`);
  }
} catch (error) {
  console.error(`[ERREUR] Impossible de configurer le fournisseur:`, error.message);
  process.exit(1);
} finally {
  // Fermer la connexion à la base de données
  db.close();
}