/**
 * Script de débogage pour insérer directement l'API Mistral dans la base de données
 * Ce script est temporaire et sera supprimé après le développement
 */
const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbService = require('./src/services/dbService');

// Chemin vers la base de données
const DB_PATH = path.join(__dirname, 'data', 'fhirhub.db');

async function initMistralAPI() {
  try {
    console.log('Initialisation du fournisseur Mistral AI pour le développement...');
    
    // Récupérer la clé API depuis les variables d'environnement
    const apiKey = process.env.MISTRAL_API_KEY;
    
    if (!apiKey) {
      throw new Error('Variable d\'environnement MISTRAL_API_KEY manquante');
    }
    
    const db = dbService.getDb();
    
    // Vérifier si le fournisseur Mistral existe déjà
    const existingProvider = db.prepare('SELECT * FROM ai_providers WHERE provider_name = ?').get('mistral');
    
    if (existingProvider) {
      console.log('Le fournisseur Mistral existe déjà. Mise à jour...');
      
      // Mettre à jour la clé API
      db.prepare(`
        UPDATE ai_providers 
        SET api_key = ?, 
            enabled = 1, 
            status = 'active',
            api_url = ?,
            models = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE provider_name = 'mistral'
      `).run(apiKey, 'https://api.mistral.ai/v1', 'mistral-large-latest');
      
      console.log('Fournisseur Mistral mis à jour avec succès !');
    } else {
      console.log('Création d\'un nouveau fournisseur Mistral...');
      
      // Paramètres par défaut pour Mistral
      const settings = JSON.stringify({
        temperature: 0.7,
        max_tokens: 4000
      });
      
      // Insérer le fournisseur Mistral
      db.prepare(`
        INSERT INTO ai_providers (
          provider_name, api_key, api_url, models, status, enabled, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'mistral',
        apiKey,
        'https://api.mistral.ai/v1',
        'mistral-large-latest',
        'active',
        1,
        settings
      );
      
      console.log('Fournisseur Mistral ajouté avec succès !');
    }
    
    // Vérifier que le fournisseur est bien configuré
    const provider = db.prepare('SELECT * FROM ai_providers WHERE provider_name = ?').get('mistral');
    console.log('Fournisseur Mistral configuré:', { 
      id: provider.id,
      provider_name: provider.provider_name,
      api_url: provider.api_url,
      models: provider.models,
      status: provider.status,
      enabled: provider.enabled
    });
    
    console.log('Initialisation du fournisseur Mistral terminée !');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du fournisseur Mistral:', error);
  }
}

// Exécuter la fonction principale
initMistralAPI();