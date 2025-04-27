/**
 * Service de gestion des applications FHIRHub
 * Permet de créer, modifier et gérer des applications et leurs paramètres
 */

const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

/**
 * Créer une nouvelle application
 * @param {Object} appData - Données de l'application
 * @returns {Object} Application créée
 */
function createApplication(appData) {
  const { name, description, retention_days, created_by } = appData;
  
  try {
    const result = db.prepare(`
      INSERT INTO applications (name, description, retention_days, created_by)
      VALUES (?, ?, ?, ?)
    `).run(name, description, retention_days || 30, created_by);
    
    const newAppId = result.lastInsertRowid;
    return getApplicationById(newAppId);
  } catch (error) {
    console.error('Erreur lors de la création de l\'application:', error);
    throw new Error(`Impossible de créer l'application: ${error.message}`);
  }
}

/**
 * Obtenir une application par son ID
 * @param {number} id - ID de l'application
 * @returns {Object|null} Application trouvée ou null
 */
function getApplicationById(id) {
  try {
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'application:', error);
    throw new Error(`Impossible de récupérer l'application: ${error.message}`);
  }
}

/**
 * Mettre à jour une application
 * @param {number} id - ID de l'application
 * @param {Object} appData - Données à mettre à jour
 * @returns {Object} Application mise à jour
 */
function updateApplication(id, appData) {
  const { name, description, active, retention_days } = appData;
  
  try {
    const app = getApplicationById(id);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    db.prepare(`
      UPDATE applications
      SET name = ?, description = ?, active = ?, retention_days = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || app.name,
      description !== undefined ? description : app.description,
      active !== undefined ? active : app.active,
      retention_days || app.retention_days,
      id
    );
    
    return getApplicationById(id);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'application:', error);
    throw new Error(`Impossible de mettre à jour l'application: ${error.message}`);
  }
}

/**
 * Supprimer une application
 * @param {number} id - ID de l'application
 * @returns {boolean} Succès de la suppression
 */
function deleteApplication(id) {
  try {
    const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'application:', error);
    throw new Error(`Impossible de supprimer l'application: ${error.message}`);
  }
}

/**
 * Lister toutes les applications
 * @param {Object} options - Options de filtrage et de tri
 * @returns {Array} Liste des applications
 */
function listApplications(options = {}) {
  const { active, search, sortBy = 'name', sortOrder = 'asc', limit = 100, offset = 0 } = options;
  
  try {
    let query = 'SELECT * FROM applications WHERE 1=1';
    const params = [];
    
    if (active !== undefined) {
      query += ' AND active = ?';
      params.push(active ? 1 : 0);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Erreur lors de la récupération des applications:', error);
    throw new Error(`Impossible de récupérer les applications: ${error.message}`);
  }
}

/**
 * Ajouter un paramètre à une application
 * @param {number} appId - ID de l'application
 * @param {Object} paramData - Données du paramètre
 * @returns {Object} Paramètre créé
 */
function addApplicationParam(appId, paramData) {
  const { param_key, param_value, param_type, description } = paramData;
  
  try {
    // Vérifier si l'application existe
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    const result = db.prepare(`
      INSERT INTO app_params (app_id, param_key, param_value, param_type, description)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(app_id, param_key) DO UPDATE SET
        param_value = excluded.param_value,
        param_type = excluded.param_type,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `).run(appId, param_key, param_value, param_type || 'string', description);
    
    return getApplicationParam(appId, param_key);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du paramètre:', error);
    throw new Error(`Impossible d'ajouter le paramètre: ${error.message}`);
  }
}

/**
 * Obtenir un paramètre d'application
 * @param {number} appId - ID de l'application
 * @param {string} paramKey - Clé du paramètre
 * @returns {Object|null} Paramètre trouvé ou null
 */
function getApplicationParam(appId, paramKey) {
  try {
    return db.prepare('SELECT * FROM app_params WHERE app_id = ? AND param_key = ?').get(appId, paramKey);
  } catch (error) {
    console.error('Erreur lors de la récupération du paramètre:', error);
    throw new Error(`Impossible de récupérer le paramètre: ${error.message}`);
  }
}

/**
 * Supprimer un paramètre d'application
 * @param {number} appId - ID de l'application
 * @param {string} paramKey - Clé du paramètre
 * @returns {boolean} Succès de la suppression
 */
function deleteApplicationParam(appId, paramKey) {
  try {
    const result = db.prepare('DELETE FROM app_params WHERE app_id = ? AND param_key = ?').run(appId, paramKey);
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression du paramètre:', error);
    throw new Error(`Impossible de supprimer le paramètre: ${error.message}`);
  }
}

/**
 * Lister tous les paramètres d'une application
 * @param {number} appId - ID de l'application
 * @returns {Array} Liste des paramètres
 */
function listApplicationParams(appId) {
  try {
    return db.prepare('SELECT * FROM app_params WHERE app_id = ?').all(appId);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    throw new Error(`Impossible de récupérer les paramètres: ${error.message}`);
  }
}

/**
 * Ajouter un dossier à surveiller pour une application
 * @param {number} appId - ID de l'application
 * @param {Object} folderData - Données du dossier
 * @returns {Object} Dossier créé
 */
function addApplicationFolder(appId, folderData) {
  const { folder_path, description, active } = folderData;
  
  try {
    // Vérifier si l'application existe
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    const result = db.prepare(`
      INSERT INTO app_folders (app_id, folder_path, description, active)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(app_id, folder_path) DO UPDATE SET
        description = excluded.description,
        active = excluded.active,
        updated_at = CURRENT_TIMESTAMP
    `).run(appId, folder_path, description, active !== undefined ? active : 1);
    
    return getApplicationFolder(appId, folder_path);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du dossier:', error);
    throw new Error(`Impossible d'ajouter le dossier: ${error.message}`);
  }
}

/**
 * Obtenir un dossier d'application
 * @param {number} appId - ID de l'application
 * @param {string} folderPath - Chemin du dossier
 * @returns {Object|null} Dossier trouvé ou null
 */
function getApplicationFolder(appId, folderPath) {
  try {
    return db.prepare('SELECT * FROM app_folders WHERE app_id = ? AND folder_path = ?').get(appId, folderPath);
  } catch (error) {
    console.error('Erreur lors de la récupération du dossier:', error);
    throw new Error(`Impossible de récupérer le dossier: ${error.message}`);
  }
}

/**
 * Supprimer un dossier d'application
 * @param {number} appId - ID de l'application
 * @param {string} folderPath - Chemin du dossier
 * @returns {boolean} Succès de la suppression
 */
function deleteApplicationFolder(appId, folderPath) {
  try {
    const result = db.prepare('DELETE FROM app_folders WHERE app_id = ? AND folder_path = ?').run(appId, folderPath);
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression du dossier:', error);
    throw new Error(`Impossible de supprimer le dossier: ${error.message}`);
  }
}

/**
 * Lister tous les dossiers d'une application
 * @param {number} appId - ID de l'application
 * @returns {Array} Liste des dossiers
 */
function listApplicationFolders(appId) {
  try {
    return db.prepare('SELECT * FROM app_folders WHERE app_id = ?').all(appId);
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    throw new Error(`Impossible de récupérer les dossiers: ${error.message}`);
  }
}

/**
 * Obtenir les statistiques d'une application
 * @param {number} appId - ID de l'application
 * @param {Object} options - Options de filtrage (période, etc.)
 * @returns {Object} Statistiques de l'application
 */
function getApplicationStats(appId, options = {}) {
  const { start_date, end_date } = options;
  
  try {
    let query = 'SELECT * FROM app_stats WHERE app_id = ?';
    const params = [appId];
    
    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY date DESC';
    
    const stats = db.prepare(query).all(...params);
    
    // Calculer les totaux
    const totals = {
      conversion_count: 0,
      success_count: 0,
      error_count: 0,
      resource_count: 0
    };
    
    stats.forEach(stat => {
      totals.conversion_count += stat.conversion_count;
      totals.success_count += stat.success_count;
      totals.error_count += stat.error_count;
      totals.resource_count += stat.resource_count;
    });
    
    return {
      daily: stats,
      totals
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    throw new Error(`Impossible de récupérer les statistiques: ${error.message}`);
  }
}

/**
 * Créer ou mettre à jour les statistiques quotidiennes d'une application
 * @param {number} appId - ID de l'application
 * @param {string} date - Date au format YYYY-MM-DD
 * @param {Object} statsData - Données statistiques à ajouter
 * @returns {Object} Statistiques mises à jour
 */
function updateApplicationStats(appId, date, statsData) {
  const { conversion_count = 0, success_count = 0, error_count = 0, resource_count = 0 } = statsData;
  
  try {
    // Vérifier si l'application existe
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    // Formater la date si nécessaire
    const formattedDate = date instanceof Date ? date.toISOString().split('T')[0] : date;
    
    // Vérifier si des statistiques existent déjà pour cette date
    const existingStat = db.prepare('SELECT * FROM app_stats WHERE app_id = ? AND date = ?').get(appId, formattedDate);
    
    if (existingStat) {
      // Mettre à jour les statistiques existantes
      db.prepare(`
        UPDATE app_stats
        SET conversion_count = conversion_count + ?,
            success_count = success_count + ?,
            error_count = error_count + ?,
            resource_count = resource_count + ?
        WHERE id = ?
      `).run(
        conversion_count,
        success_count,
        error_count,
        resource_count,
        existingStat.id
      );
    } else {
      // Créer de nouvelles statistiques
      db.prepare(`
        INSERT INTO app_stats (app_id, date, conversion_count, success_count, error_count, resource_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        appId,
        formattedDate,
        conversion_count,
        success_count,
        error_count,
        resource_count
      );
    }
    
    return db.prepare('SELECT * FROM app_stats WHERE app_id = ? AND date = ?').get(appId, formattedDate);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
    throw new Error(`Impossible de mettre à jour les statistiques: ${error.message}`);
  }
}

/**
 * Obtenir le détail complet d'une application avec tous ses paramètres, dossiers et clés API
 * @param {number} appId - ID de l'application
 * @returns {Object} Application avec détails complets
 */
function getApplicationDetails(appId) {
  try {
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    const params = listApplicationParams(appId);
    const folders = listApplicationFolders(appId);
    
    // Les clés API seront récupérées par le service dédié
    
    return {
      ...app,
      params,
      folders
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'application:', error);
    throw new Error(`Impossible de récupérer les détails: ${error.message}`);
  }
}

// Exporter les fonctions du service
module.exports = {
  createApplication,
  getApplicationById,
  updateApplication,
  deleteApplication,
  listApplications,
  addApplicationParam,
  getApplicationParam,
  deleteApplicationParam,
  listApplicationParams,
  addApplicationFolder,
  getApplicationFolder,
  deleteApplicationFolder,
  listApplicationFolders,
  getApplicationStats,
  updateApplicationStats,
  getApplicationDetails
};