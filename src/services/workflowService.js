/**
 * Service de gestion des workflows pour FHIRHub
 * Remplace l'intégration Node-RED par un éditeur visuel intégré
 */

const db = require('./dbService');
const path = require('path');
const fs = require('fs');

// État du service
let initialized = false;

/**
 * Initialiser le service de workflow
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    if (initialized) {
      return;
    }
    
    console.log('[WORKFLOW] Initialisation du service de workflow...');
    
    // Vérifier que la connexion à la base de données est établie
    if (!db.isInitialized()) {
      console.log('[WORKFLOW] Initialisation de la base de données requise');
      await db.initialize();
    }
    
    // Créer le répertoire pour les données de workflow si nécessaire
    const workflowDir = path.join(process.cwd(), 'data', 'workflows');
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }
    
    console.log('[WORKFLOW] Éditeur Node-RED non disponible');
    
    initialized = true;
    console.log('[WORKFLOW] Service de workflow initialisé avec succès');
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de l\'initialisation du service de workflow:', error);
    throw error;
  }
}

/**
 * Obtenir tous les workflows
 * @returns {Promise<Array>} Liste des workflows
 */
async function getAllWorkflows() {
  try {
    await initialize();
    
    const workflows = await db.query(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      ORDER BY w.updated_at DESC
    `);
    
    return workflows;
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la récupération des workflows:', error);
    throw error;
  }
}

/**
 * Obtenir tous les workflows d'une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Array>} Liste des workflows de l'application
 */
async function getWorkflowsByApplicationId(applicationId) {
  try {
    await initialize();
    
    const workflows = await db.query(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      WHERE w.application_id = ?
      ORDER BY w.updated_at DESC
    `, [applicationId]);
    
    return workflows;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la récupération des workflows pour l'application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Obtenir un workflow par son ID
 * @param {number} id - ID du workflow
 * @returns {Promise<Object|null>} Workflow trouvé ou null
 */
async function getWorkflowById(id) {
  try {
    await initialize();
    
    const workflow = await db.get(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      WHERE w.id = ?
    `, [id]);
    
    return workflow;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la récupération du workflow ${id}:`, error);
    throw error;
  }
}

/**
 * Créer un nouveau workflow
 * @param {Object} workflowData - Données du workflow
 * @returns {Promise<Object>} Workflow créé
 */
async function createWorkflow(workflowData) {
  try {
    await initialize();
    
    // Validation des données obligatoires
    if (!workflowData.application_id || !workflowData.name) {
      throw new Error('L\'ID de l\'application et le nom du workflow sont obligatoires');
    }
    
    // Créer un flow JSON vide par défaut si non fourni
    if (!workflowData.flow_json) {
      workflowData.flow_json = JSON.stringify([]);
    }
    
    // Insertion en base de données
    const result = await db.run(`
      INSERT INTO workflows (
        application_id, name, description, is_active, flow_json
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      workflowData.application_id,
      workflowData.name,
      workflowData.description || '',
      workflowData.is_active === undefined ? 1 : workflowData.is_active,
      typeof workflowData.flow_json === 'string' ? workflowData.flow_json : JSON.stringify(workflowData.flow_json)
    ]);
    
    if (result.lastID) {
      const newWorkflow = await getWorkflowById(result.lastID);
      console.log(`[WORKFLOW] Workflow "${workflowData.name}" créé avec succès`);
      return newWorkflow;
    } else {
      throw new Error('Erreur lors de la création du workflow');
    }
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la création du workflow:', error);
    throw error;
  }
}

/**
 * Mettre à jour un workflow
 * @param {number} id - ID du workflow
 * @param {Object} workflowData - Nouvelles données du workflow
 * @returns {Promise<Object>} Workflow mis à jour
 */
async function updateWorkflow(id, workflowData) {
  try {
    await initialize();
    
    // Vérifier si le workflow existe
    const existingWorkflow = await getWorkflowById(id);
    if (!existingWorkflow) {
      throw new Error(`Workflow avec l'ID ${id} non trouvé`);
    }
    
    // Construire la requête de mise à jour
    let updateFields = [];
    let updateValues = [];
    
    if (workflowData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(workflowData.name);
    }
    
    if (workflowData.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(workflowData.description);
    }
    
    if (workflowData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(workflowData.is_active);
    }
    
    if (workflowData.flow_json !== undefined) {
      updateFields.push('flow_json = ?');
      updateValues.push(typeof workflowData.flow_json === 'string' 
        ? workflowData.flow_json 
        : JSON.stringify(workflowData.flow_json));
    }
    
    if (workflowData.application_id !== undefined) {
      updateFields.push('application_id = ?');
      updateValues.push(workflowData.application_id);
    }
    
    // Mettre à jour la date de modification
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Exécuter la mise à jour
    if (updateFields.length > 0) {
      updateValues.push(id);
      
      const result = await db.run(`
        UPDATE workflows 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `, updateValues);
      
      if (result.changes > 0) {
        const updatedWorkflow = await getWorkflowById(id);
        console.log(`[WORKFLOW] Workflow avec l'ID ${id} mis à jour avec succès`);
        return updatedWorkflow;
      } else {
        console.log(`[WORKFLOW] Aucune modification apportée au workflow avec l'ID ${id}`);
        return existingWorkflow;
      }
    } else {
      console.log(`[WORKFLOW] Aucun champ à mettre à jour pour le workflow avec l'ID ${id}`);
      return existingWorkflow;
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la mise à jour du workflow avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Supprimer un workflow
 * @param {number} id - ID du workflow
 * @returns {Promise<boolean>} Succès de la suppression
 */
async function deleteWorkflow(id) {
  try {
    await initialize();
    
    // Vérifier si le workflow existe
    const existingWorkflow = await getWorkflowById(id);
    if (!existingWorkflow) {
      throw new Error(`Workflow avec l'ID ${id} non trouvé`);
    }
    
    // Suppression
    const result = await db.run('DELETE FROM workflows WHERE id = ?', [id]);
    
    if (result.changes > 0) {
      console.log(`[WORKFLOW] Workflow avec l'ID ${id} supprimé avec succès`);
      return true;
    } else {
      console.error(`[WORKFLOW] Erreur lors de la suppression du workflow avec l'ID ${id}`);
      return false;
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la suppression du workflow avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Exécuter un workflow pour une application
 * @param {number} applicationId - ID de l'application
 * @param {Object} inputData - Données d'entrée (message HL7)
 * @returns {Promise<Object>} Résultat du workflow
 */
async function executeWorkflow(applicationId, inputData) {
  try {
    await initialize();
    
    // Récupérer les workflows actifs pour cette application
    const workflows = await db.query(`
      SELECT * FROM workflows
      WHERE application_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [applicationId]);
    
    if (!workflows || workflows.length === 0) {
      console.log(`[WORKFLOW] Aucun workflow actif trouvé pour l'application ${applicationId}`);
      return null;
    }
    
    const workflow = workflows[0];
    console.log(`[WORKFLOW] Exécution du workflow "${workflow.name}" pour l'application ${applicationId}`);
    
    // Ici, en production, on exécuterait le workflow via l'API Node-RED
    // Pour simplifier, on se contente de retourner les données d'entrée telles quelles
    return inputData;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'exécution du workflow pour l'application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Obtenir l'URL de l'éditeur de workflow
 * @param {number} workflowId - ID du workflow à éditer
 * @returns {string} URL pour l'édition du workflow
 */
function getEditorUrl(workflowId) {
  // Nous avons changé l'approche pour utiliser un éditeur JSON simplifié
  // au lieu d'intégrer Node-RED directement
  // Le paramètre useJsonEditor=true indique au frontend d'utiliser l'éditeur JSON 
  // au lieu de tenter d'ouvrir Node-RED
  const editorUrl = `/workflows.html?editWorkflow=${workflowId}&useJsonEditor=true`;
  console.log(`[WORKFLOW] URL de l'éditeur de workflow: ${editorUrl}`);
  
  return editorUrl;
}

/**
 * Exporter les définitions des nœuds personnalisés pour Node-RED
 * @returns {Object} Définitions des nœuds personnalisés
 */
function getCustomNodeDefinitions() {
  return {
    // Nœud d'entrée HL7
    'fhirhub-hl7-input': {
      category: 'fhirhub',
      color: '#E63946',
      defaults: {
        name: { value: '' }
      },
      inputs: 0,
      outputs: 1,
      icon: 'font-awesome/fa-sign-in',
      label: function() { return this.name || 'HL7 Input'; }
    },
    
    // Nœud de conversion FHIR
    'fhirhub-fhir-converter': {
      category: 'fhirhub',
      color: '#457B9D',
      defaults: {
        name: { value: '' },
        messageType: { value: 'ADT' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-exchange',
      label: function() { return this.name || 'FHIR Converter'; }
    },
    
    // Nœud de sortie FHIR
    'fhirhub-fhir-output': {
      category: 'fhirhub',
      color: '#1D3557',
      defaults: {
        name: { value: '' }
      },
      inputs: 1,
      outputs: 0,
      icon: 'font-awesome/fa-sign-out',
      label: function() { return this.name || 'FHIR Output'; }
    },
    
    // Nœud d'extraction de segments HL7
    'fhirhub-segment-extractor': {
      category: 'fhirhub',
      color: '#F1FAEE',
      defaults: {
        name: { value: '' },
        segment: { value: 'PID' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-filter',
      label: function() { return this.name || `Extract ${this.segment}`; }
    },
    
    // Nœud de validation FHIR
    'fhirhub-fhir-validator': {
      category: 'fhirhub',
      color: '#A8DADC',
      defaults: {
        name: { value: '' },
        resourceType: { value: 'Patient' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-check-circle',
      label: function() { return this.name || 'FHIR Validator'; }
    }
  };
}

// Exporter les fonctions du service
module.exports = {
  initialize,
  getAllWorkflows,
  getWorkflowsByApplicationId,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getEditorUrl,
  getCustomNodeDefinitions,
  // Cette fonction n'est plus disponible mais est maintenue pour la compatibilité
  getRedApp: () => null
};