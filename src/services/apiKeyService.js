/**
 * Service de gestion des clés API pour FHIRHub
 * Permet la création, vérification et gestion des clés API
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const dbService = require('./dbService');

/**
 * Générer une nouvelle clé API
 * @param {string} prefix - Préfixe pour la clé API (par exemple: dev, prod, test)
 * @returns {string} Clé API générée
 */
function generateApiKey(prefix = 'fh') {
  // Générer une clé aléatoire basée sur un UUID et encodée en base64
  const randomKey = crypto
    .createHash('sha256')
    .update(uuidv4())
    .digest('base64')
    .replace(/[+/=]/g, '')  // Remplacer les caractères non URL-safe
    .substring(0, 24);      // Limiter la longueur
  
  // Formater avec un préfixe et des tirets pour une meilleure lisibilité
  return `${prefix}_${randomKey.substring(0, 8)}_${randomKey.substring(8, 16)}_${randomKey.substring(16)}`;
}

/**
 * Créer une nouvelle clé API pour une application
 * @param {Object} keyData - Données de la clé API
 * @returns {Promise<Object>} Clé API créée
 */
async function createApiKey(keyData) {
  try {
    // S'assurer que les champs obligatoires sont présents
    if (!keyData.application_id || !keyData.name) {
      throw new Error('Le nom et l\'identifiant de l\'application sont obligatoires');
    }
    
    // Déterminer le préfixe de la clé en fonction de l'environnement
    const environment = keyData.environment || 'development';
    let prefix = 'fh';
    
    switch (environment) {
      case 'development':
        prefix = 'dev';
        break;
      case 'testing':
        prefix = 'test';
        break;
      case 'production':
        prefix = 'prod';
        break;
    }
    
    // Générer une clé API
    const apiKey = keyData.key || generateApiKey(prefix);
    
    // Insérer la clé API dans la base de données
    const result = await dbService.run(
      `INSERT INTO api_keys (
        application_id, key, name, environment, active,
        expires_at, rate_limit, ip_restrictions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        keyData.application_id,
        apiKey,
        keyData.name,
        environment,
        keyData.active !== undefined ? keyData.active : 1,
        keyData.expires_at || null,
        keyData.rate_limit || 100,
        keyData.ip_restrictions || null
      ]
    );
    
    // Créer les limites d'utilisation pour cette clé API
    await dbService.run(
      `INSERT INTO api_usage_limits (
        application_id, api_key_id, daily_limit, monthly_limit
      ) VALUES (?, ?, ?, ?)`,
      [
        keyData.application_id,
        result.lastID,
        keyData.daily_limit || 1000,
        keyData.monthly_limit || 10000
      ]
    );
    
    // Récupérer la clé API créée
    const createdKey = await getApiKey(result.lastID);
    
    return createdKey;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la création de la clé API:', error);
    throw error;
  }
}

/**
 * Vérifier une clé API
 * @param {string} apiKey - Clé API à vérifier
 * @returns {Promise<Object|null>} Informations sur la clé API ou null si invalide
 */
async function verifyApiKey(apiKey) {
  try {
    // Mode développement : si la clé est "dev-key", authentification contournée
    if (apiKey === 'dev-key' && process.env.NODE_ENV !== 'production') {
      console.log('[API-KEY] Mode développement: authentification contournée');
      
      // Récupérer l'application par défaut
      const defaultApp = await dbService.get(
        'SELECT id FROM applications WHERE name = ? LIMIT 1',
        ['Application par défaut']
      );
      
      if (defaultApp) {
        return {
          id: 0,
          key: 'dev-key',
          name: 'Clé de développement',
          environment: 'development',
          application_id: defaultApp.id,
          active: true,
          isDevKey: true
        };
      }
    }
    
    // Récupérer la clé API depuis la base de données
    const key = await dbService.get(
      `SELECT k.*, a.name as application_name 
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      WHERE k.key = ? AND k.active = 1`,
      [apiKey]
    );
    
    // Si la clé n'existe pas ou n'est pas active, retourner null
    if (!key) {
      return null;
    }
    
    // Vérifier si la clé API est expirée
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      console.log(`[API-KEY] Clé API expirée: ${apiKey}`);
      return null;
    }
    
    // Mettre à jour la date de dernière utilisation
    await dbService.run(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?',
      [key.id]
    );
    
    // Mettre à jour les compteurs d'utilisation
    await updateUsageCounters(key.id, key.application_id);
    
    // Vérifier si les limites d'utilisation sont dépassées
    const usageLimits = await checkUsageLimits(key.id, key.application_id);
    
    if (!usageLimits.withinLimits) {
      console.log(`[API-KEY] Limite d'utilisation dépassée pour la clé API: ${apiKey}`);
      
      if (usageLimits.dailyExceeded) {
        console.log(`[API-KEY] Limite quotidienne dépassée: ${usageLimits.currentDaily}/${usageLimits.dailyLimit}`);
      }
      
      if (usageLimits.monthlyExceeded) {
        console.log(`[API-KEY] Limite mensuelle dépassée: ${usageLimits.currentMonthly}/${usageLimits.monthlyLimit}`);
      }
      
      return null;
    }
    
    return {
      id: key.id,
      key: key.key,
      name: key.name,
      environment: key.environment,
      application_id: key.application_id,
      application_name: key.application_name,
      active: !!key.active,
      usageLimits
    };
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la vérification de la clé API:', error);
    
    // En cas d'erreur, permettre l'accès en mode développement
    if (apiKey === 'dev-key' && process.env.NODE_ENV !== 'production') {
      console.log('[API-KEY] Mode développement: accès accordé malgré l\'erreur');
      
      return {
        id: 0,
        key: 'dev-key',
        name: 'Clé de développement',
        environment: 'development',
        application_id: 1,
        active: true,
        isDevKey: true,
        error: error.message
      };
    }
    
    return null;
  }
}

/**
 * Mettre à jour les compteurs d'utilisation d'une clé API
 * @param {number} apiKeyId - ID de la clé API
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<void>}
 */
async function updateUsageCounters(apiKeyId, applicationId) {
  try {
    // Récupérer les limites d'utilisation
    const limits = await dbService.get(
      'SELECT * FROM api_usage_limits WHERE api_key_id = ? AND application_id = ?',
      [apiKeyId, applicationId]
    );
    
    if (!limits) {
      // Si les limites n'existent pas, les créer
      await dbService.run(
        `INSERT INTO api_usage_limits (
          application_id, api_key_id, daily_limit, monthly_limit,
          current_daily_usage, current_monthly_usage
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [applicationId, apiKeyId, 1000, 10000, 1, 1]
      );
      
      return;
    }
    
    // Vérifier si les compteurs doivent être réinitialisés
    const now = new Date();
    const lastResetDaily = new Date(limits.last_reset_daily);
    const lastResetMonthly = new Date(limits.last_reset_monthly);
    
    // Réinitialiser le compteur quotidien si nécessaire (jour différent)
    let resetDaily = false;
    if (now.getDate() !== lastResetDaily.getDate() || 
        now.getMonth() !== lastResetDaily.getMonth() || 
        now.getFullYear() !== lastResetDaily.getFullYear()) {
      resetDaily = true;
    }
    
    // Réinitialiser le compteur mensuel si nécessaire (mois ou année différent)
    let resetMonthly = false;
    if (now.getMonth() !== lastResetMonthly.getMonth() || 
        now.getFullYear() !== lastResetMonthly.getFullYear()) {
      resetMonthly = true;
    }
    
    // Mettre à jour les compteurs
    if (resetDaily && resetMonthly) {
      await dbService.run(
        `UPDATE api_usage_limits 
        SET current_daily_usage = 1, current_monthly_usage = 1,
            last_reset_daily = CURRENT_TIMESTAMP, last_reset_monthly = CURRENT_TIMESTAMP
        WHERE api_key_id = ? AND application_id = ?`,
        [apiKeyId, applicationId]
      );
    } else if (resetDaily) {
      await dbService.run(
        `UPDATE api_usage_limits 
        SET current_daily_usage = 1, current_monthly_usage = current_monthly_usage + 1,
            last_reset_daily = CURRENT_TIMESTAMP
        WHERE api_key_id = ? AND application_id = ?`,
        [apiKeyId, applicationId]
      );
    } else if (resetMonthly) {
      await dbService.run(
        `UPDATE api_usage_limits 
        SET current_daily_usage = current_daily_usage + 1, current_monthly_usage = 1,
            last_reset_monthly = CURRENT_TIMESTAMP
        WHERE api_key_id = ? AND application_id = ?`,
        [apiKeyId, applicationId]
      );
    } else {
      // Incrémenter les deux compteurs
      await dbService.run(
        `UPDATE api_usage_limits 
        SET current_daily_usage = current_daily_usage + 1, 
            current_monthly_usage = current_monthly_usage + 1
        WHERE api_key_id = ? AND application_id = ?`,
        [apiKeyId, applicationId]
      );
    }
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la mise à jour des compteurs d\'utilisation:', error);
  }
}

/**
 * Vérifier les limites d'utilisation d'une clé API
 * @param {number} apiKeyId - ID de la clé API
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Statut des limites d'utilisation
 */
async function checkUsageLimits(apiKeyId, applicationId) {
  try {
    // Récupérer les limites d'utilisation
    const limits = await dbService.get(
      'SELECT * FROM api_usage_limits WHERE api_key_id = ? AND application_id = ?',
      [apiKeyId, applicationId]
    );
    
    if (!limits) {
      // Si les limites n'existent pas, considérer qu'elles ne sont pas dépassées
      return {
        withinLimits: true,
        dailyExceeded: false,
        monthlyExceeded: false,
        currentDaily: 0,
        currentMonthly: 0,
        dailyLimit: 1000,
        monthlyLimit: 10000
      };
    }
    
    // Vérifier si les limites sont dépassées
    const dailyExceeded = limits.current_daily_usage > limits.daily_limit;
    const monthlyExceeded = limits.current_monthly_usage > limits.monthly_limit;
    
    return {
      withinLimits: !dailyExceeded && !monthlyExceeded,
      dailyExceeded,
      monthlyExceeded,
      currentDaily: limits.current_daily_usage,
      currentMonthly: limits.current_monthly_usage,
      dailyLimit: limits.daily_limit,
      monthlyLimit: limits.monthly_limit
    };
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la vérification des limites d\'utilisation:', error);
    
    // En cas d'erreur, considérer que les limites ne sont pas dépassées
    return {
      withinLimits: true,
      dailyExceeded: false,
      monthlyExceeded: false,
      error: error.message
    };
  }
}

/**
 * Obtenir une clé API par son ID
 * @param {number} id - ID de la clé API
 * @returns {Promise<Object|null>} Clé API ou null si non trouvée
 */
async function getApiKey(id) {
  try {
    return await dbService.get(
      `SELECT k.*, a.name as application_name 
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      WHERE k.id = ?`,
      [id]
    );
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération de la clé API:', error);
    return null;
  }
}

/**
 * Obtenir toutes les clés API d'une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Array>} Clés API de l'application
 */
async function getApiKeysByApplication(applicationId) {
  try {
    return await dbService.query(
      `SELECT k.*, a.name as application_name,
        (SELECT SUM(usage_count) FROM api_keys WHERE application_id = k.application_id) as total_app_usage
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      WHERE k.application_id = ?
      ORDER BY k.last_used_at DESC`,
      [applicationId]
    );
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération des clés API par application:', error);
    return [];
  }
}

/**
 * Obtenir toutes les clés API avec statistiques
 * @returns {Promise<Array>} Toutes les clés API avec statistiques
 */
async function getAllApiKeys() {
  try {
    const keys = await dbService.query(
      `SELECT k.*, a.name as application_name, a.owner_id,
        u.daily_limit, u.monthly_limit, u.current_daily_usage, u.current_monthly_usage,
        (SELECT COUNT(*) FROM conversion_logs WHERE api_key_id = k.id) as conversion_count
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      LEFT JOIN api_usage_limits u ON k.id = u.api_key_id AND k.application_id = u.application_id
      ORDER BY k.last_used_at DESC`
    );
    
    return keys;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération de toutes les clés API:', error);
    return [];
  }
}

/**
 * Mettre à jour les informations d'une clé API
 * @param {number} id - ID de la clé API
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<boolean>} True si la mise à jour a réussi
 */
async function updateApiKey(id, updateData) {
  try {
    // Vérifier si la clé API existe
    const existingKey = await getApiKey(id);
    
    if (!existingKey) {
      return false;
    }
    
    // Préparer les champs et valeurs à mettre à jour
    const updateFields = [];
    const updateValues = [];
    
    // Champs autorisés à mettre à jour
    const allowedFields = ['name', 'active', 'environment', 'expires_at', 'rate_limit', 'ip_restrictions'];
    
    // Construire la requête de mise à jour
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }
    
    // Si aucun champ n'est à mettre à jour, retourner true
    if (updateFields.length === 0) {
      return true;
    }
    
    // Ajouter l'ID à la fin des valeurs pour la clause WHERE
    updateValues.push(id);
    
    // Exécuter la mise à jour
    const result = await dbService.run(
      `UPDATE api_keys SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    );
    
    // Mettre à jour les limites d'utilisation si spécifiées
    if (updateData.daily_limit !== undefined || updateData.monthly_limit !== undefined) {
      const usageLimits = await dbService.get(
        'SELECT * FROM api_usage_limits WHERE api_key_id = ?',
        [id]
      );
      
      if (usageLimits) {
        const limitUpdateFields = [];
        const limitUpdateValues = [];
        
        if (updateData.daily_limit !== undefined) {
          limitUpdateFields.push('daily_limit = ?');
          limitUpdateValues.push(updateData.daily_limit);
        }
        
        if (updateData.monthly_limit !== undefined) {
          limitUpdateFields.push('monthly_limit = ?');
          limitUpdateValues.push(updateData.monthly_limit);
        }
        
        if (limitUpdateFields.length > 0) {
          limitUpdateValues.push(id);
          
          await dbService.run(
            `UPDATE api_usage_limits SET ${limitUpdateFields.join(', ')} WHERE api_key_id = ?`,
            limitUpdateValues
          );
        }
      }
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la mise à jour de la clé API:', error);
    return false;
  }
}

/**
 * Révoquer une clé API
 * @param {number} id - ID de la clé API
 * @returns {Promise<boolean>} True si la révocation a réussi
 */
async function revokeApiKey(id) {
  try {
    const result = await dbService.run(
      'UPDATE api_keys SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la révocation de la clé API:', error);
    return false;
  }
}

/**
 * Supprimer une clé API
 * @param {number} id - ID de la clé API
 * @returns {Promise<boolean>} True si la suppression a réussi
 */
async function deleteApiKey(id) {
  try {
    // Supprimer les limites d'utilisation associées
    await dbService.run(
      'DELETE FROM api_usage_limits WHERE api_key_id = ?',
      [id]
    );
    
    // Supprimer la clé API
    const result = await dbService.run(
      'DELETE FROM api_keys WHERE id = ?',
      [id]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la suppression de la clé API:', error);
    return false;
  }
}

/**
 * Obtenir les statistiques d'utilisation des clés API
 * @returns {Promise<Object>} Statistiques d'utilisation
 */
async function getApiKeyStats() {
  try {
    // Statistiques générales
    const generalStats = await dbService.get(
      `SELECT 
        COUNT(*) as total_keys,
        SUM(usage_count) as total_usage,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_keys,
        SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive_keys,
        COUNT(DISTINCT application_id) as total_applications
      FROM api_keys`
    );
    
    // Utilisation par environnement
    const environmentStats = await dbService.query(
      `SELECT 
        environment,
        COUNT(*) as key_count,
        SUM(usage_count) as usage_count
      FROM api_keys
      GROUP BY environment
      ORDER BY usage_count DESC`
    );
    
    // Clés API les plus utilisées
    const topKeys = await dbService.query(
      `SELECT k.id, k.key, k.name, k.environment, k.usage_count, a.name as application_name
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      ORDER BY k.usage_count DESC
      LIMIT 5`
    );
    
    // Applications avec le plus grand nombre de clés
    const topApplications = await dbService.query(
      `SELECT a.id, a.name, COUNT(k.id) as key_count, SUM(k.usage_count) as total_usage
      FROM applications a
      JOIN api_keys k ON a.id = k.application_id
      GROUP BY a.id
      ORDER BY key_count DESC
      LIMIT 5`
    );
    
    return {
      generalStats,
      environmentStats,
      topKeys,
      topApplications
    };
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la récupération des statistiques d\'utilisation des clés API:', error);
    
    return {
      generalStats: {
        total_keys: 0,
        total_usage: 0,
        active_keys: 0,
        inactive_keys: 0,
        total_applications: 0
      },
      environmentStats: [],
      topKeys: [],
      topApplications: []
    };
  }
}

module.exports = {
  generateApiKey,
  createApiKey,
  verifyApiKey,
  getApiKey,
  getApiKeysByApplication,
  getAllApiKeys,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  getApiKeyStats,
  updateUsageCounters,
  checkUsageLimits
};