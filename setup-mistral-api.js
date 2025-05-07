/**
 * Point d'accès pour configurer rapidement le fournisseur Mistral AI
 */
const express = require('express');
const router = express.Router();
const dbService = require('../src/db/dbService');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Route pour configurer le fournisseur Mistral AI
router.get('/setup-mistral', async (req, res) => {
  try {
    // Récupérer la clé API Mistral de l'environnement
    const mistralApiKey = process.env.MISTRAL_API_KEY || 'VNjTxMwJ1UwOpQBDERIAwdWKK4LHsCXd';
    
    // Vérifier si le fournisseur Mistral existe déjà
    const existingProvider = await dbService.get(
      'SELECT id FROM ai_providers WHERE provider_name = ?', 
      ['Mistral AI']
    );
    
    if (existingProvider) {
      // Mise à jour du fournisseur existant
      console.log('[SETUP] Fournisseur Mistral AI existant trouvé, mise à jour...');
      
      await dbService.run(
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
        ]
      );
      
      console.log(`[SETUP] Fournisseur Mistral AI mis à jour avec succès (ID: ${existingProvider.id})`);
      
      return res.json({
        success: true,
        message: `Fournisseur Mistral AI mis à jour avec succès (ID: ${existingProvider.id})`,
        provider: {
          id: existingProvider.id,
          name: 'Mistral AI',
          status: 'active',
          enabled: true
        }
      });
    } else {
      // Création d'un nouveau fournisseur
      console.log('[SETUP] Aucun fournisseur Mistral AI trouvé, création...');
      
      const result = await dbService.run(
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
        ]
      );
      
      const newId = result.lastID;
      console.log(`[SETUP] Fournisseur Mistral AI créé avec succès (ID: ${newId})`);
      
      return res.json({
        success: true,
        message: `Fournisseur Mistral AI créé avec succès (ID: ${newId})`,
        provider: {
          id: newId,
          name: 'Mistral AI',
          status: 'active',
          enabled: true
        }
      });
    }
  } catch (error) {
    console.error(`[ERREUR] Impossible de configurer le fournisseur Mistral AI: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: `Erreur lors de la configuration du fournisseur Mistral AI: ${error.message}`
    });
  }
});

module.exports = router;