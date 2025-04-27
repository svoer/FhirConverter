/**
 * Service pour la gestion des applications
 * Fournit des fonctions pour créer, récupérer, mettre à jour et supprimer des applications
 * ainsi que pour gérer leurs paramètres
 */

const { db } = require('../db/schema');

/**
 * Récupérer toutes les applications
 * @returns {Array} Liste des applications
 */
function getAllApplications() {
  return db.prepare(`
    SELECT a.*, 
           COUNT(DISTINCT k.id) as api_key_count, 
           COUNT(DISTINCT c.id) as conversion_count
    FROM applications a
    LEFT JOIN api_keys k ON a.id = k.app_id
    LEFT JOIN conversions c ON a.id = c.app_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();
}

/**
 * Récupérer une application par son ID
 * @param {number} id - ID de l'application
 * @returns {Object|null} Application ou null si non trouvée
 */
function getApplicationById(id) {
  const app = db.prepare(`
    SELECT * FROM applications WHERE id = ?
  `).get(id);
  
  if (!app) {
    return null;
  }
  
  // Récupérer les paramètres de l'application
  const params = db.prepare(`
    SELECT param_key, param_value FROM app_params WHERE app_id = ?
  `).all(id);
  
  // Convertir les paramètres en objet
  const parameters = {};
  params.forEach(param => {
    parameters[param.param_key] = param.param_value;
  });
  
  return {
    ...app,
    parameters
  };
}

/**
 * Récupérer une application par son nom
 * @param {string} name - Nom de l'application
 * @returns {Object|null} Application ou null si non trouvée
 */
function getApplicationByName(name) {
  return db.prepare(`
    SELECT * FROM applications WHERE name = ?
  `).get(name);
}

/**
 * Créer une nouvelle application
 * @param {Object} appData - Données de l'application
 * @param {string} appData.name - Nom de l'application
 * @param {string} [appData.description] - Description de l'application
 * @param {number} [appData.retention_days=30] - Durée de rétention des logs en jours
 * @param {Object} [appData.parameters={}] - Paramètres personnalisés
 * @param {number} [userId] - ID de l'utilisateur qui crée l'application
 * @returns {Object} Application créée
 * @throws {Error} Si le nom est déjà utilisé
 */
function createApplication(appData, userId = 1) {
  // Valider les données
  if (!appData.name) {
    throw new Error('Le nom de l\'application est obligatoire');
  }
  
  // Vérifier si le nom est déjà utilisé
  const existingApp = getApplicationByName(appData.name);
  if (existingApp) {
    throw new Error(`Une application avec le nom "${appData.name}" existe déjà`);
  }
  
  // Créer l'application
  const result = db.prepare(`
    INSERT INTO applications (name, description, retention_days, created_by)
    VALUES (?, ?, ?, ?)
  `).run(
    appData.name,
    appData.description || null,
    appData.retention_days || 30,
    userId
  );
  
  const appId = result.lastInsertRowid;
  
  // Ajouter les paramètres de l'application
  const parameters = appData.parameters || {};
  
  const insertParam = db.prepare(`
    INSERT INTO app_params (app_id, param_key, param_value)
    VALUES (?, ?, ?)
  `);
  
  for (const [key, value] of Object.entries(parameters)) {
    insertParam.run(appId, key, value);
  }
  
  // Retourner l'application créée
  return getApplicationById(appId);
}

/**
 * Mettre à jour une application
 * @param {number} id - ID de l'application
 * @param {Object} appData - Données à mettre à jour
 * @returns {Object} Application mise à jour
 * @throws {Error} Si l'application n'existe pas
 */
function updateApplication(id, appData) {
  // Vérifier si l'application existe
  const app = getApplicationById(id);
  if (!app) {
    throw new Error(`L'application avec l'ID ${id} n'existe pas`);
  }
  
  // Mettre à jour les champs de base de l'application
  if (appData.name || appData.description || appData.retention_days || appData.active !== undefined) {
    const fields = [];
    const values = [];
    
    if (appData.name) {
      fields.push('name = ?');
      values.push(appData.name);
    }
    
    if (appData.description !== undefined) {
      fields.push('description = ?');
      values.push(appData.description);
    }
    
    if (appData.retention_days) {
      fields.push('retention_days = ?');
      values.push(appData.retention_days);
    }
    
    if (appData.active !== undefined) {
      fields.push('active = ?');
      values.push(appData.active ? 1 : 0);
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      
      db.prepare(`
        UPDATE applications
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values, id);
    }
  }
  
  // Mettre à jour les paramètres si fournis
  if (appData.parameters) {
    updateApplicationParameters(id, appData.parameters);
  }
  
  // Retourner l'application mise à jour
  return getApplicationById(id);
}

/**
 * Mettre à jour les paramètres d'une application
 * @param {number} appId - ID de l'application
 * @param {Object} parameters - Nouveaux paramètres
 * @returns {Object} Paramètres mis à jour
 * @throws {Error} Si l'application n'existe pas
 */
function updateApplicationParameters(appId, parameters) {
  // Vérifier si l'application existe
  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(appId);
  if (!app) {
    throw new Error(`L'application avec l'ID ${appId} n'existe pas`);
  }
  
  // Supprimer tous les paramètres actuels
  db.prepare('DELETE FROM app_params WHERE app_id = ?').run(appId);
  
  // Ajouter les nouveaux paramètres
  const insertParam = db.prepare(`
    INSERT INTO app_params (app_id, param_key, param_value)
    VALUES (?, ?, ?)
  `);
  
  for (const [key, value] of Object.entries(parameters)) {
    insertParam.run(appId, key, value);
  }
  
  // Récupérer et retourner les paramètres mis à jour
  const params = db.prepare(`
    SELECT param_key, param_value FROM app_params WHERE app_id = ?
  `).all(appId);
  
  const updatedParams = {};
  params.forEach(param => {
    updatedParams[param.param_key] = param.param_value;
  });
  
  return updatedParams;
}

/**
 * Supprimer un paramètre d'une application
 * @param {number} appId - ID de l'application
 * @param {string} paramKey - Clé du paramètre à supprimer
 * @returns {boolean} True si le paramètre a été supprimé
 * @throws {Error} Si l'application n'existe pas
 */
function deleteApplicationParameter(appId, paramKey) {
  // Vérifier si l'application existe
  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(appId);
  if (!app) {
    throw new Error(`L'application avec l'ID ${appId} n'existe pas`);
  }
  
  // Supprimer le paramètre
  const result = db.prepare(`
    DELETE FROM app_params
    WHERE app_id = ? AND param_key = ?
  `).run(appId, paramKey);
  
  return result.changes > 0;
}

/**
 * Supprimer une application
 * @param {number} id - ID de l'application
 * @returns {boolean} True si l'application a été supprimée
 */
function deleteApplication(id) {
  const result = db.prepare(`
    DELETE FROM applications WHERE id = ?
  `).run(id);
  
  return result.changes > 0;
}

/**
 * Récupérer toutes les clés API d'une application
 * @param {number} appId - ID de l'application
 * @returns {Array} Liste des clés API
 */
function getApplicationApiKeys(appId) {
  return db.prepare(`
    SELECT * FROM api_keys
    WHERE app_id = ?
    ORDER BY created_at DESC
  `).all(appId);
}

/**
 * Vérifier si une application existe
 * @param {number} id - ID de l'application
 * @returns {boolean} True si l'application existe
 */
function applicationExists(id) {
  const result = db.prepare('SELECT id FROM applications WHERE id = ?').get(id);
  return !!result;
}

module.exports = {
  getAllApplications,
  getApplicationById,
  getApplicationByName,
  createApplication,
  updateApplication,
  updateApplicationParameters,
  deleteApplicationParameter,
  deleteApplication,
  getApplicationApiKeys,
  applicationExists
};