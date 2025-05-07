/**
 * Script pour configurer Mistral AI comme fournisseur d'IA actif dans FHIRHub
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Chemin standardisé vers la base de données
const dbPath = process.env.DB_PATH || './storage/db/fhirhub.db';

console.log(`[SETUP] Connexion à la base de données: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`[ERREUR] Impossible de se connecter à la base de données: ${err.message}`);
    process.exit(1);
  }
  console.log('[SETUP] Connexion à la base de données établie');
});

// Récupérer la clé API Mistral de l'environnement
const mistralApiKey = process.env.MISTRAL_API_KEY || 'VNjTxMwJ1UwOpQBDERIAwdWKK4LHsCXd';

// Vérifier si le fournisseur Mistral existe déjà
db.get('SELECT id FROM ai_providers WHERE provider_name = ?', ['Mistral AI'], (err, row) => {
  if (err) {
    console.error(`[ERREUR] Erreur lors de la vérification du fournisseur: ${err.message}`);
    db.close();
    process.exit(1);
  }

  if (row) {
    // Mise à jour du fournisseur existant
    console.log('[SETUP] Fournisseur Mistral AI existant trouvé, mise à jour...');
    db.run(
      `UPDATE ai_providers 
      SET api_key = ?, api_url = ?, models = ?, status = ?, enabled = 1, 
      updated_at = CURRENT_TIMESTAMP, settings = ? 
      WHERE provider_name = ?`,
      [
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
      ],
      function(err) {
        if (err) {
          console.error(`[ERREUR] Impossible de mettre à jour le fournisseur: ${err.message}`);
          db.close();
          process.exit(1);
        }
        console.log(`[SETUP] Fournisseur Mistral AI mis à jour avec succès (ID: ${row.id})`);
        db.close();
      }
    );
  } else {
    // Création d'un nouveau fournisseur
    console.log('[SETUP] Aucun fournisseur Mistral AI trouvé, création...');
    db.run(
      `INSERT INTO ai_providers 
      (provider_name, api_key, api_url, models, status, enabled, settings) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
      function(err) {
        if (err) {
          console.error(`[ERREUR] Impossible de créer le fournisseur: ${err.message}`);
          db.close();
          process.exit(1);
        }
        console.log(`[SETUP] Fournisseur Mistral AI créé avec succès (ID: ${this.lastID})`);
        db.close();
      }
    );
  }
});