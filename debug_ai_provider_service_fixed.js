/**
 * Script de débogage pour insérer directement l'API Mistral dans la base de données
 * Ce script est temporaire et sera supprimé après le développement
 */
const dbService = require('./src/services/dbService');

async function initMistralAPI() {
  try {
    console.log('Initialisation du fournisseur Mistral AI pour le développement...');
    
    // Récupérer la clé API depuis les variables d'environnement
    const apiKey = process.env.MISTRAL_API_KEY;
    
    if (!apiKey) {
      throw new Error('Variable d\'environnement MISTRAL_API_KEY manquante');
    }
    
    // Initialiser la connexion à la base de données
    await dbService.initialize();
    
    // Vérifier si le fournisseur Mistral existe déjà
    const existingProvider = await dbService.get('SELECT * FROM ai_providers WHERE provider_name = ?', ['mistral']);
    
    if (existingProvider) {
      console.log('Le fournisseur Mistral existe déjà. Mise à jour...');
      
      // Mettre à jour la clé API
      await dbService.run(`
        UPDATE ai_providers 
        SET api_key = ?, 
            enabled = 1, 
            status = 'active',
            api_url = ?,
            models = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE provider_name = 'mistral'
      `, [apiKey, 'https://api.mistral.ai/v1', 'mistral-large-latest']);
      
      console.log('Fournisseur Mistral mis à jour avec succès !');
    } else {
      console.log('Création d\'un nouveau fournisseur Mistral...');
      
      // Paramètres par défaut pour Mistral
      const settings = JSON.stringify({
        temperature: 0.7,
        max_tokens: 4000
      });
      
      // Insérer le fournisseur Mistral
      await dbService.run(`
        INSERT INTO ai_providers (
          provider_name, api_key, api_url, models, status, enabled, settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'mistral',
        apiKey,
        'https://api.mistral.ai/v1',
        'mistral-large-latest',
        'active',
        1,
        settings
      ]);
      
      console.log('Fournisseur Mistral ajouté avec succès !');
    }
    
    // Vérifier que le fournisseur est bien configuré
    const provider = await dbService.get('SELECT * FROM ai_providers WHERE provider_name = ?', ['mistral']);
    console.log('Fournisseur Mistral configuré:', { 
      id: provider.id,
      provider_name: provider.provider_name,
      api_url: provider.api_url,
      models: provider.models,
      status: provider.status,
      enabled: provider.enabled
    });
    
    console.log('Initialisation du fournisseur Mistral terminée !');
    
    // Fermer la connexion à la base de données
    await dbService.close();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du fournisseur Mistral:', error);
    // Fermer la connexion à la base de données en cas d'erreur
    try {
      await dbService.close();
    } catch (closeError) {
      console.error('Erreur lors de la fermeture de la connexion:', closeError);
    }
  }
}

// Exécuter la fonction principale
initMistralAPI();