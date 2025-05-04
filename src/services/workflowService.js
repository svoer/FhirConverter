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
    
    console.log('[WORKFLOW] Initialisation de l\'éditeur de workflow visuel personnalisé');
    
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
    
    // Analyse et exécution du workflow
    try {
      const flow = JSON.parse(workflow.flow_json);
      
      if (!flow || !flow.nodes || !flow.edges) {
        console.log(`[WORKFLOW] Structure de workflow invalide pour l'application ${applicationId}`);
        return { error: "Structure de workflow invalide", input: inputData };
      }
      
      console.log(`[WORKFLOW] Structure du workflow: ${flow.nodes.length} nœuds, ${flow.edges.length} connexions`);
      
      // Exécuter le workflow
      const result = await executeWorkflowNodes(flow, inputData, applicationId);
      return result;
    } catch (parseError) {
      console.error(`[WORKFLOW] Erreur de parse JSON pour le workflow:`, parseError);
      return { error: "Format JSON du workflow invalide", input: inputData };
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'exécution du workflow pour l'application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Exécuter les nœuds d'un workflow basé sur sa structure
 * @param {Object} flow - Structure du workflow (nœuds et arêtes)
 * @param {Object} inputData - Données d'entrée initiales
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Résultat final du workflow
 */
async function executeWorkflowNodes(flow, inputData, applicationId) {
  // Structure pour stocker les résultats intermédiaires des nœuds
  const nodeResults = {};
  
  // Identifier les nœuds d'entrée (sans connexions entrantes)
  const entryNodes = findEntryNodes(flow);
  
  if (entryNodes.length === 0) {
    console.log(`[WORKFLOW] Aucun nœud d'entrée trouvé dans le workflow`);
    return { error: "Aucun nœud d'entrée trouvé", input: inputData };
  }
  
  console.log(`[WORKFLOW] Nœuds d'entrée identifiés: ${entryNodes.map(n => n.id).join(', ')}`);
  
  // Commencer l'exécution à partir des nœuds d'entrée
  for (const entryNode of entryNodes) {
    // Ajouter les données d'entrée au premier nœud
    nodeResults[entryNode.id] = { 
      data: inputData, 
      outputs: {}, 
      processed: false 
    };
  }
  
  // Exécuter les nœuds dans l'ordre topologique
  let progress = true;
  const maxIterations = flow.nodes.length * 2; // Éviter les boucles infinies
  let iteration = 0;
  
  while (progress && iteration < maxIterations) {
    progress = false;
    iteration++;
    
    for (const node of flow.nodes) {
      // Vérifier si le nœud a déjà été traité
      if (nodeResults[node.id] && nodeResults[node.id].processed) {
        continue;
      }
      
      // Vérifier si toutes les entrées nécessaires sont disponibles
      const inputsReady = checkNodeInputsReady(node, flow, nodeResults);
      
      if (inputsReady) {
        // Collecter les données d'entrée pour ce nœud
        const nodeInputs = collectNodeInputs(node, flow, nodeResults);
        
        // Exécuter le nœud avec ses entrées
        try {
          console.log(`[WORKFLOW] Exécution du nœud ${node.id} (${node.type})`);
          const nodeOutput = await executeNode(node, nodeInputs, applicationId);
          
          // Stocker le résultat
          nodeResults[node.id] = {
            data: nodeOutput,
            outputs: {},
            processed: true
          };
          
          // Distribuer les sorties aux différents ports
          if (node.outputs && node.outputs.length > 0) {
            node.outputs.forEach((output, index) => {
              nodeResults[node.id].outputs[index] = nodeOutput;
            });
          }
          
          progress = true;
        } catch (nodeError) {
          console.error(`[WORKFLOW] Erreur lors de l'exécution du nœud ${node.id}:`, nodeError);
          nodeResults[node.id] = {
            error: nodeError.message || "Erreur d'exécution",
            processed: true
          };
        }
      }
    }
  }
  
  if (iteration >= maxIterations) {
    console.warn(`[WORKFLOW] Nombre maximum d'itérations atteint, possible boucle dans le workflow`);
  }
  
  // Trouver les nœuds de sortie (sans connexions sortantes)
  const outputNodes = findOutputNodes(flow);
  
  // Collecter les résultats finaux
  const results = {};
  for (const outputNode of outputNodes) {
    if (nodeResults[outputNode.id]) {
      results[outputNode.id] = nodeResults[outputNode.id].data;
    }
  }
  
  return {
    results,
    nodeResults,
    outputNodes: outputNodes.map(n => n.id)
  };
}

/**
 * Trouver les nœuds d'entrée dans un workflow (sans connexions entrantes)
 * @param {Object} flow - Structure du workflow
 * @returns {Array} Nœuds d'entrée
 */
function findEntryNodes(flow) {
  // Créer un ensemble de tous les nœuds cibles
  const targetNodeIds = new Set();
  flow.edges.forEach(edge => {
    targetNodeIds.add(edge.target);
  });
  
  // Les nœuds d'entrée sont ceux qui ne sont pas des cibles
  return flow.nodes.filter(node => !targetNodeIds.has(node.id));
}

/**
 * Trouver les nœuds de sortie dans un workflow (sans connexions sortantes)
 * @param {Object} flow - Structure du workflow
 * @returns {Array} Nœuds de sortie
 */
function findOutputNodes(flow) {
  // Créer un ensemble de tous les nœuds sources
  const sourceNodeIds = new Set();
  flow.edges.forEach(edge => {
    sourceNodeIds.add(edge.source);
  });
  
  // Les nœuds de sortie sont ceux qui sont des sources mais pas des cibles
  // ou qui ont le type 'fhir-output'
  return flow.nodes.filter(node => 
    (!sourceNodeIds.has(node.id) || node.type === 'fhir-output' || node.type === 'file-output')
  );
}

/**
 * Vérifier si toutes les entrées nécessaires pour un nœud sont disponibles
 * @param {Object} node - Nœud à vérifier
 * @param {Object} flow - Structure du workflow
 * @param {Object} nodeResults - Résultats des nœuds déjà exécutés
 * @returns {boolean} Vrai si toutes les entrées sont prêtes
 */
function checkNodeInputsReady(node, flow, nodeResults) {
  // Si c'est un nœud d'entrée sans entrées, il est prêt
  if (!node.inputs || node.inputs.length === 0) {
    return true;
  }
  
  // Pour chaque entrée du nœud, vérifier si les nœuds sources ont été traités
  const incomingEdges = flow.edges.filter(edge => edge.target === node.id);
  
  // S'il n'y a pas d'arêtes entrantes mais le nœud a des entrées, il n'est pas prêt
  if (incomingEdges.length === 0 && node.inputs.length > 0) {
    return false;
  }
  
  // Vérifier que chaque entrée requise est connectée et que le nœud source a été traité
  for (let i = 0; i < node.inputs.length; i++) {
    const inputPort = i;
    const edgesForInput = incomingEdges.filter(edge => edge.targetInput === inputPort);
    
    // Si cette entrée n'est pas connectée, passer à la suivante
    if (edgesForInput.length === 0) {
      continue;
    }
    
    // Vérifier que toutes les sources de cette entrée ont été traitées
    for (const edge of edgesForInput) {
      const sourceNode = edge.source;
      const sourcePort = edge.sourceOutput;
      
      if (!nodeResults[sourceNode] || 
          !nodeResults[sourceNode].processed || 
          !nodeResults[sourceNode].outputs || 
          nodeResults[sourceNode].outputs[sourcePort] === undefined) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Collecter les entrées pour un nœud à partir des résultats des nœuds précédents
 * @param {Object} node - Nœud pour lequel collecter les entrées
 * @param {Object} flow - Structure du workflow
 * @param {Object} nodeResults - Résultats des nœuds déjà exécutés
 * @returns {Object} Entrées collectées
 */
function collectNodeInputs(node, flow, nodeResults) {
  const inputs = {};
  
  // Si c'est un nœud d'entrée sans connexions entrantes, utiliser directement son résultat
  const incomingEdges = flow.edges.filter(edge => edge.target === node.id);
  if (incomingEdges.length === 0 && nodeResults[node.id]) {
    return nodeResults[node.id].data;
  }
  
  // Pour chaque port d'entrée, collecter les données des nœuds sources
  if (node.inputs) {
    for (let i = 0; i < node.inputs.length; i++) {
      const inputPort = i;
      const inputName = node.inputs[i].name;
      
      const edgesForInput = incomingEdges.filter(edge => edge.targetInput === inputPort);
      
      if (edgesForInput.length > 0) {
        // Prendre la dernière connexion si plusieurs sont sur le même port
        const edge = edgesForInput[edgesForInput.length - 1];
        const sourceNode = edge.source;
        const sourcePort = edge.sourceOutput;
        
        if (nodeResults[sourceNode] && 
            nodeResults[sourceNode].outputs && 
            nodeResults[sourceNode].outputs[sourcePort] !== undefined) {
          inputs[inputName] = nodeResults[sourceNode].outputs[sourcePort];
        }
      }
    }
  }
  
  return inputs;
}

/**
 * Exécuter un nœud spécifique du workflow
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Résultat de l'exécution du nœud
 */
async function executeNode(node, inputs, applicationId) {
  console.log(`[WORKFLOW] Exécution du nœud de type "${node.type}" avec les entrées:`, inputs);
  
  switch (node.type) {
    case 'hl7-input':
      // Nœud d'entrée HL7, retourne simplement les données ou les données du nœud
      return handleHl7Input(node, inputs);
      
    case 'json-input':
      // Nœud d'entrée JSON, retourne simplement les données ou les données du nœud
      return handleJsonInput(node, inputs);
      
    case 'segment-extractor':
      // Extraire un segment spécifique d'un message HL7
      return handleSegmentExtractor(node, inputs);
      
    case 'field-mapper':
      // Mapper des champs d'un format à un autre
      return handleFieldMapper(node, inputs);
      
    case 'condition':
      // Nœud de condition pour le routage
      return handleCondition(node, inputs);
      
    case 'transform':
      // Transformer des données
      return handleTransform(node, inputs);
      
    case 'fhir-converter':
      // Convertir en format FHIR
      return handleFhirConverter(node, inputs);
      
    case 'api-call':
      // Effectuer un appel API
      return handleApiCall(node, inputs, applicationId);
      
    case 'fhir-output':
    case 'file-output':
      // Nœuds de sortie, passent simplement les données
      return inputs;
      
    default:
      console.warn(`[WORKFLOW] Type de nœud "${node.type}" non pris en charge`);
      return inputs;
  }
}

/**
 * Gérer l'exécution d'un nœud d'entrée HL7
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleHl7Input(node, inputs) {
  // Si des données sont déjà présentes, les utiliser
  if (inputs && Object.keys(inputs).length > 0) {
    return inputs;
  }
  
  // Sinon, utiliser les données configurées dans le nœud
  if (node.data && node.data.source === 'sample') {
    // Utiliser l'exemple de message HL7
    return { hl7: node.data.sampleMessage || 'MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230420131440||ADT^A01|20230420131440|P|2.5||' };
  } else if (node.data && node.data.source === 'file' && node.data.filePath) {
    // Lire depuis un fichier
    try {
      const fs = require('fs');
      const filePath = node.data.filePath;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return { hl7: fileContent };
    } catch (error) {
      console.error(`[WORKFLOW] Erreur lors de la lecture du fichier HL7:`, error);
      return { error: "Erreur de lecture du fichier HL7" };
    }
  } else {
    // Source manuelle ou par défaut
    return { hl7: inputs.message || '' };
  }
}

/**
 * Gérer l'exécution d'un nœud d'entrée JSON
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleJsonInput(node, inputs) {
  // Si des données sont déjà présentes, les utiliser
  if (inputs && Object.keys(inputs).length > 0) {
    return inputs;
  }
  
  // Sinon, utiliser les données configurées dans le nœud
  if (node.data && node.data.source === 'sample') {
    try {
      // Utiliser l'exemple JSON
      return JSON.parse(node.data.sampleJson || '{}');
    } catch (error) {
      console.error(`[WORKFLOW] Erreur lors du parse du JSON d'exemple:`, error);
      return { error: "JSON d'exemple invalide" };
    }
  } else if (node.data && node.data.source === 'file' && node.data.filePath) {
    // Lire depuis un fichier
    try {
      const fs = require('fs');
      const filePath = node.data.filePath;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`[WORKFLOW] Erreur lors de la lecture du fichier JSON:`, error);
      return { error: "Erreur de lecture ou parsing du fichier JSON" };
    }
  } else {
    // Source manuelle ou par défaut
    return inputs;
  }
}

/**
 * Gérer l'exécution d'un nœud d'extraction de segment HL7
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleSegmentExtractor(node, inputs) {
  if (!inputs.hl7) {
    return { error: "Message HL7 manquant" };
  }
  
  try {
    const segmentType = (node.data && node.data.segment) || 'PID';
    const hl7Message = inputs.hl7;
    
    // Extraction simple basée sur les lignes commençant par le type de segment
    const lines = hl7Message.split('\n');
    const segments = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(segmentType + '|')) {
        segments.push(trimmedLine);
      }
    }
    
    return {
      segment: segmentType,
      found: segments.length > 0,
      segments: segments,
      original: hl7Message
    };
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'extraction de segment:`, error);
    return { error: "Erreur d'extraction de segment" };
  }
}

/**
 * Gérer l'exécution d'un nœud de mappage de champs
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleFieldMapper(node, inputs) {
  try {
    const mappings = (node.data && node.data.mappings) || [];
    const result = { ...inputs };
    
    // Appliquer les mappings configurés
    for (const mapping of mappings) {
      if (mapping.source && mapping.target) {
        // Extraire la valeur source (support de la notation par points)
        let sourceValue = inputs;
        const sourcePath = mapping.source.split('.');
        
        for (const part of sourcePath) {
          if (sourceValue === undefined) break;
          sourceValue = sourceValue[part];
        }
        
        // Définir la valeur cible (support de la notation par points)
        if (sourceValue !== undefined) {
          const targetPath = mapping.target.split('.');
          let targetObject = result;
          
          // Créer l'arborescence d'objets si nécessaire
          for (let i = 0; i < targetPath.length - 1; i++) {
            const part = targetPath[i];
            if (!targetObject[part]) {
              targetObject[part] = {};
            }
            targetObject = targetObject[part];
          }
          
          // Affecter la valeur
          const lastPart = targetPath[targetPath.length - 1];
          targetObject[lastPart] = sourceValue;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors du mappage de champs:`, error);
    return { error: "Erreur de mappage", inputs };
  }
}

/**
 * Gérer l'exécution d'un nœud de condition
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleCondition(node, inputs) {
  try {
    const condition = (node.data && node.data.condition) || '';
    const valueToCheck = inputs.value;
    
    let result = false;
    
    // Évaluer la condition
    if (condition === 'equals' && node.data.value !== undefined) {
      result = valueToCheck === node.data.value;
    } else if (condition === 'notEquals' && node.data.value !== undefined) {
      result = valueToCheck !== node.data.value;
    } else if (condition === 'contains' && node.data.value !== undefined) {
      result = String(valueToCheck).includes(String(node.data.value));
    } else if (condition === 'greaterThan' && node.data.value !== undefined) {
      result = Number(valueToCheck) > Number(node.data.value);
    } else if (condition === 'lessThan' && node.data.value !== undefined) {
      result = Number(valueToCheck) < Number(node.data.value);
    } else if (condition === 'isTrue') {
      result = Boolean(valueToCheck);
    } else if (condition === 'isFalse') {
      result = !Boolean(valueToCheck);
    } else if (condition === 'isEmpty') {
      result = valueToCheck === undefined || valueToCheck === null || valueToCheck === '';
    } else if (condition === 'isNotEmpty') {
      result = valueToCheck !== undefined && valueToCheck !== null && valueToCheck !== '';
    } else {
      // Condition par défaut ou expression JavaScript
      try {
        // Pour des raisons de sécurité, nous n'utilisons pas eval()
        // mais plutôt une comparaison directe
        result = Boolean(valueToCheck);
      } catch (evalError) {
        console.error(`[WORKFLOW] Erreur lors de l'évaluation de la condition:`, evalError);
        result = false;
      }
    }
    
    // Retourner le résultat avec des chemins pour true et false
    return {
      result,
      condition: {
        evaluated: true,
        type: condition,
        value: node.data.value,
        inputValue: valueToCheck
      },
      // Inclure les données d'entrée pour les traiter dans les branches true/false
      ...inputs
    };
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'évaluation de la condition:`, error);
    return { error: "Erreur d'évaluation de condition", inputs };
  }
}

/**
 * Gérer l'exécution d'un nœud de transformation
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleTransform(node, inputs) {
  try {
    const transformType = (node.data && node.data.transformType) || 'passthrough';
    
    switch (transformType) {
      case 'uppercase':
        return { 
          result: typeof inputs.input === 'string' ? inputs.input.toUpperCase() : inputs.input,
          original: inputs.input
        };
        
      case 'lowercase':
        return { 
          result: typeof inputs.input === 'string' ? inputs.input.toLowerCase() : inputs.input,
          original: inputs.input
        };
        
      case 'number':
        return { 
          result: Number(inputs.input),
          original: inputs.input
        };
        
      case 'boolean':
        return { 
          result: Boolean(inputs.input),
          original: inputs.input
        };
        
      case 'json':
        if (typeof inputs.input === 'string') {
          try {
            return { 
              result: JSON.parse(inputs.input),
              original: inputs.input
            };
          } catch (parseError) {
            return { error: "Erreur de parse JSON", original: inputs.input };
          }
        }
        return { result: inputs.input, original: inputs.input };
        
      case 'string':
        return { 
          result: String(inputs.input),
          original: inputs.input
        };
        
      case 'custom':
        // Application d'une transformation personnalisée configurée dans le nœud
        if (node.data && node.data.customTransform) {
          try {
            // Pour des raisons de sécurité, nous utilisons un mécanisme limité
            // au lieu de eval() ou Function()
            
            const template = node.data.customTransform;
            const inputValue = inputs.input;
            
            // Exemple simple de remplacement de variables dans un template
            const result = template.replace(/\$\{input\}/g, inputValue);
            
            return { 
              result,
              original: inputs.input,
              template: template
            };
          } catch (transformError) {
            console.error(`[WORKFLOW] Erreur lors de la transformation personnalisée:`, transformError);
            return { error: "Erreur de transformation personnalisée", original: inputs.input };
          }
        }
        return { result: inputs.input, original: inputs.input };
        
      case 'passthrough':
      default:
        // Simplement passer les données telles quelles
        return inputs;
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la transformation:`, error);
    return { error: "Erreur de transformation", inputs };
  }
}

/**
 * Gérer l'exécution d'un nœud de conversion FHIR
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleFhirConverter(node, inputs) {
  try {
    // Dans une implémentation réelle, cette fonction utiliserait une bibliothèque
    // de conversion HL7 vers FHIR comme hapi-fhir-js ou une API de conversion
    
    // Pour cet exemple, nous simulons une conversion simple
    const messageType = (node.data && node.data.messageType) || 'ADT';
    const hl7Message = inputs.hl7 || '';
    
    console.log(`[WORKFLOW] Conversion FHIR pour message de type ${messageType}`);
    
    // Exemple simple d'extraction des segments PID pour créer une resource Patient
    const lines = hl7Message.split('\n');
    const pidSegment = lines.find(line => line.trim().startsWith('PID|'));
    
    // Créer un objet FHIR Patient minimal basé sur le segment PID
    const patient = {
      resourceType: 'Patient',
      id: `generated-${Date.now()}`,
      meta: {
        lastUpdated: new Date().toISOString()
      },
      identifier: [],
      name: [{
        family: 'Doe',
        given: ['John']
      }],
      gender: 'unknown',
      birthDate: '1970-01-01'
    };
    
    // Si nous avons un segment PID, essayer d'extraire quelques informations de base
    if (pidSegment) {
      const fields = pidSegment.split('|');
      
      // PID-3 est généralement l'identifiant du patient
      if (fields.length > 3 && fields[3]) {
        patient.identifier.push({
          system: 'urn:oid:1.2.3.4.5',
          value: fields[3]
        });
      }
      
      // PID-5 est généralement le nom du patient
      if (fields.length > 5 && fields[5]) {
        const nameParts = fields[5].split('^');
        if (nameParts.length > 0) {
          patient.name[0].family = nameParts[0] || 'Unknown';
          if (nameParts.length > 1) {
            patient.name[0].given = [nameParts[1]];
          }
        }
      }
      
      // PID-7 est généralement la date de naissance
      if (fields.length > 7 && fields[7]) {
        // Format HL7 est souvent YYYYMMDD
        const dob = fields[7];
        if (/^\d{8}$/.test(dob)) {
          patient.birthDate = `${dob.substring(0, 4)}-${dob.substring(4, 6)}-${dob.substring(6, 8)}`;
        } else {
          patient.birthDate = dob;
        }
      }
      
      // PID-8 est généralement le sexe
      if (fields.length > 8 && fields[8]) {
        const gender = fields[8];
        if (gender === 'M') {
          patient.gender = 'male';
        } else if (gender === 'F') {
          patient.gender = 'female';
        } else {
          patient.gender = 'unknown';
        }
      }
    }
    
    return {
      fhir: patient,
      sourceMessage: hl7Message,
      messageType
    };
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la conversion FHIR:`, error);
    return { error: "Erreur de conversion FHIR", inputs };
  }
}

/**
 * Gérer l'exécution d'un nœud d'appel API
 * @param {Object} node - Nœud à exécuter
 * @param {Object} inputs - Entrées pour le nœud
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function handleApiCall(node, inputs, applicationId) {
  try {
    // Obtenir les configurations du nœud
    const method = (node.data && node.data.method) || 'GET';
    const url = (node.data && node.data.url) || '';
    const headers = (node.data && node.data.headers) || {};
    const timeout = (node.data && node.data.timeout) || 30000; // 30 secondes par défaut
    
    if (!url) {
      return { error: "URL d'API manquante", inputs };
    }
    
    console.log(`[WORKFLOW] Appel API: ${method} ${url}`);
    
    // Préparation des données à envoyer
    let requestData = inputs.data;
    
    // Obtenir une clé API pour l'application si nécessaire
    let apiKey = null;
    if (node.data && node.data.useApiKey) {
      try {
        const apiKeys = await db.query(`
          SELECT * FROM api_keys
          WHERE application_id = ?
          AND is_active = 1
          LIMIT 1
        `, [applicationId]);
        
        if (apiKeys && apiKeys.length > 0) {
          apiKey = apiKeys[0].key;
        }
      } catch (dbError) {
        console.error(`[WORKFLOW] Erreur lors de la récupération de la clé API:`, dbError);
      }
    }
    
    // Configurer les en-têtes avec la clé API si disponible
    const requestHeaders = { ...headers };
    if (apiKey) {
      requestHeaders['X-API-Key'] = apiKey;
    }
    
    // Déterminer le content-type si non fourni
    if (!requestHeaders['Content-Type'] && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    
    // Effectuer la requête HTTP avec fetch
    try {
      const fetchOptions = {
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout: timeout
      };
      
      // Ajouter le corps de la requête pour les méthodes qui le supportent
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestData) {
        fetchOptions.body = typeof requestData === 'string' 
          ? requestData 
          : JSON.stringify(requestData);
      }
      
      // Module pour les requêtes HTTP
      const axios = require('axios');
      
      const startTime = Date.now();
      const response = await axios({
        method: method.toUpperCase(),
        url: url,
        headers: requestHeaders,
        data: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? requestData : undefined,
        timeout: timeout
      });
      const endTime = Date.now();
      
      // Enregistrer l'activité API si nécessaire
      if (node.data && node.data.logActivity) {
        try {
          await db.run(`
            INSERT INTO api_activity_logs (
              api_key_id, application_id, endpoint, method, status_code, response_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            apiKey ? (apiKeys[0].id || null) : null,
            applicationId,
            url,
            method.toUpperCase(),
            response.status,
            endTime - startTime
          ]);
        } catch (logError) {
          console.error(`[WORKFLOW] Erreur lors de l'enregistrement de l'activité API:`, logError);
        }
      }
      
      // Retourner les résultats
      return {
        statusCode: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
        requestUrl: url,
        requestMethod: method.toUpperCase(),
        responseTime: endTime - startTime
      };
    } catch (fetchError) {
      console.error(`[WORKFLOW] Erreur lors de l'appel API:`, fetchError);
      
      // En cas d'erreur, enregistrer l'activité API avec le code d'erreur
      if (node.data && node.data.logActivity) {
        try {
          await db.run(`
            INSERT INTO api_activity_logs (
              api_key_id, application_id, endpoint, method, status_code, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            apiKey ? (apiKeys[0].id || null) : null,
            applicationId,
            url,
            method.toUpperCase(),
            fetchError.response ? fetchError.response.status : 0
          ]);
        } catch (logError) {
          console.error(`[WORKFLOW] Erreur lors de l'enregistrement de l'activité API en erreur:`, logError);
        }
      }
      
      return { 
        error: fetchError.message || "Erreur lors de l'appel API",
        statusCode: fetchError.response ? fetchError.response.status : null,
        statusText: fetchError.response ? fetchError.response.statusText : null,
        requestUrl: url,
        requestMethod: method.toUpperCase()
      };
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'exécution de l'appel API:`, error);
    return { error: "Erreur d'appel API", inputs };
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
 * Exporter les définitions des nœuds personnalisés pour l'éditeur de workflow
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

/**
 * Récupérer tous les templates de workflow prédéfinis
 * @returns {Promise<Array>} Liste des templates
 */
async function getWorkflowTemplates() {
  try {
    // Vérifier l'initialisation
    if (!initialized) {
      await initialize();
    }
    
    // Chemin vers le répertoire des templates
    const templatesDir = path.join(process.cwd(), 'data', 'templates');
    
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
      
      // Créer les templates par défaut
      await createDefaultTemplates(templatesDir);
    }
    
    // Lire tous les fichiers de template
    const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
    
    // Charger les templates
    const templates = files.map(file => {
      const filePath = path.join(templatesDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      try {
        const template = JSON.parse(fileContent);
        template.id = path.basename(file, '.json'); // Utiliser le nom du fichier comme ID
        return template;
      } catch (e) {
        console.error(`[WORKFLOW] Erreur lors du parsing du template ${file}:`, e);
        return null;
      }
    }).filter(Boolean); // Filtrer les templates invalides
    
    return templates;
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la récupération des templates de workflow:', error);
    throw error;
  }
}

/**
 * Récupérer un template de workflow par son ID
 * @param {string} templateId - ID du template
 * @returns {Promise<Object|null>} Template ou null si non trouvé
 */
async function getWorkflowTemplateById(templateId) {
  try {
    // Vérifier l'initialisation
    if (!initialized) {
      await initialize();
    }
    
    // Chemin vers le fichier de template
    const templatePath = path.join(process.cwd(), 'data', 'templates', `${templateId}.json`);
    
    // Vérifier si le template existe
    if (!fs.existsSync(templatePath)) {
      return null;
    }
    
    // Lire le template
    const fileContent = fs.readFileSync(templatePath, 'utf8');
    const template = JSON.parse(fileContent);
    template.id = templateId;
    
    return template;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la récupération du template ${templateId}:`, error);
    throw error;
  }
}

/**
 * Créer les templates par défaut
 * @param {string} templatesDir - Chemin vers le répertoire des templates
 * @returns {Promise<void>}
 */
async function createDefaultTemplates(templatesDir) {
  try {
    // Template 1: Convertisseur HL7 vers FHIR simple
    const hl7ToFhirTemplate = {
      name: "Convertisseur HL7 vers FHIR simple",
      description: "Template de base pour convertir un message HL7 en ressource FHIR. Idéal pour démarrer un nouveau projet d'intégration.",
      template_version: "1.0",
      created_at: new Date().toISOString(),
      metadata: {
        author: "FHIRHub",
        category: "conversion",
        tags: ["hl7", "fhir", "conversion", "débutant"]
      },
      nodes: [
        {
          id: "1",
          type: "hl7-input",
          position: { x: 100, y: 200 },
          data: { name: "Entrée HL7" },
          ports: {
            input: [],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "2",
          type: "field-mapper",
          position: { x: 400, y: 200 },
          data: { name: "Mapper champs", config: { mapRules: [] } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "3",
          type: "fhir-converter",
          position: { x: 700, y: 200 },
          data: { name: "Convertir FHIR" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "4",
          type: "fhir-output",
          position: { x: 1000, y: 200 },
          data: { name: "Sortie FHIR" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: []
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e2-3", source: "2", target: "3", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "output1", targetHandle: "input1" }
      ]
    };
    
    // Template 2: Workflow pour interface SIH
    const sihInterfaceTemplate = {
      name: "Interface SIH complète",
      description: "Template d'intégration complète avec un Système d'Information Hospitalier. Inclut la validation, la transformation et l'audit des messages.",
      template_version: "1.0",
      created_at: new Date().toISOString(),
      metadata: {
        author: "FHIRHub",
        category: "intégration",
        tags: ["sih", "hôpital", "intégration", "audit"]
      },
      nodes: [
        {
          id: "1",
          type: "mllp",
          position: { x: 100, y: 200 },
          data: { name: "Récepteur MLLP", config: { port: 2575 } },
          ports: {
            input: [],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "2",
          type: "validator",
          position: { x: 400, y: 200 },
          data: { name: "Validation HL7", config: { strictMode: true } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [
              { id: "valid", label: "Valide" },
              { id: "invalid", label: "Invalide" }
            ]
          }
        },
        {
          id: "3",
          type: "hl7-to-fhir",
          position: { x: 700, y: 100 },
          data: { name: "Conversion FHIR" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "4",
          type: "api-call",
          position: { x: 1000, y: 100 },
          data: { name: "API SIH", config: { url: "/api/sih/patients", method: "POST" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "5",
          type: "error-handler",
          position: { x: 700, y: 300 },
          data: { name: "Gestion erreurs", config: { retryCount: 3 } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "6",
          type: "logger",
          position: { x: 1000, y: 300 },
          data: { name: "Journalisation", config: { logLevel: "error" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: []
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e2-3", source: "2", target: "3", sourceHandle: "valid", targetHandle: "input1" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e2-5", source: "2", target: "5", sourceHandle: "invalid", targetHandle: "input1" },
        { id: "e5-6", source: "5", target: "6", sourceHandle: "output1", targetHandle: "input1" }
      ]
    };
    
    // Template 3: Extraction de données patients
    const patientDataTemplate = {
      name: "Extraction données patients",
      description: "Template pour l'extraction et le traitement des données patients à partir de messages HL7 ADT. Optimisé pour l'interopérabilité.",
      template_version: "1.0",
      created_at: new Date().toISOString(),
      metadata: {
        author: "FHIRHub",
        category: "extraction",
        tags: ["patient", "adt", "démographie", "extraction"]
      },
      nodes: [
        {
          id: "1",
          type: "hl7-input",
          position: { x: 100, y: 200 },
          data: { name: "Entrée HL7 ADT" },
          ports: {
            input: [],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "2",
          type: "segment-extractor",
          position: { x: 400, y: 200 },
          data: { name: "Extractor PID", config: { segment: "PID" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "3",
          type: "anonymizer",
          position: { x: 700, y: 200 },
          data: { name: "Anonymisation", config: { fields: ["PID.5", "PID.7", "PID.19"] } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "4",
          type: "database-query",
          position: { x: 1000, y: 200 },
          data: { name: "Stockage BDD", config: { table: "patients" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "5",
          type: "email-sender",
          position: { x: 1300, y: 200 },
          data: { name: "Notification", config: { template: "patient_update" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: []
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e2-3", source: "2", target: "3", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e4-5", source: "4", target: "5", sourceHandle: "output1", targetHandle: "input1" }
      ]
    };
    
    // Template 4: Interopérabilité DMP
    const dmpTemplate = {
      name: "Interopérabilité DMP",
      description: "Template pour l'intégration avec le Dossier Médical Partagé français, incluant la conversion CDA et l'identification INS.",
      template_version: "1.0",
      created_at: new Date().toISOString(),
      metadata: {
        author: "FHIRHub",
        category: "dmp",
        tags: ["dmp", "ins", "cda", "france", "interopérabilité"]
      },
      nodes: [
        {
          id: "1",
          type: "file-input",
          position: { x: 100, y: 200 },
          data: { name: "Entrée fichier CDA" },
          ports: {
            input: [],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "2",
          type: "ins-lookup",
          position: { x: 400, y: 200 },
          data: { name: "Recherche INS" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "3",
          type: "cda-to-fhir",
          position: { x: 700, y: 200 },
          data: { name: "Conversion CDA->FHIR" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [{ id: "output1", label: "Output" }]
          }
        },
        {
          id: "4",
          type: "dmp-export",
          position: { x: 1000, y: 200 },
          data: { name: "Export DMP" },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: [
              { id: "success", label: "Succès" },
              { id: "error", label: "Erreur" }
            ]
          }
        },
        {
          id: "5",
          type: "logger",
          position: { x: 1300, y: 100 },
          data: { name: "Log succès", config: { logLevel: "info" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: []
          }
        },
        {
          id: "6",
          type: "logger",
          position: { x: 1300, y: 300 },
          data: { name: "Log erreur", config: { logLevel: "error" } },
          ports: {
            input: [{ id: "input1", label: "Input" }],
            output: []
          }
        }
      ],
      edges: [
        { id: "e1-2", source: "1", target: "2", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e2-3", source: "2", target: "3", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e3-4", source: "3", target: "4", sourceHandle: "output1", targetHandle: "input1" },
        { id: "e4-5", source: "4", target: "5", sourceHandle: "success", targetHandle: "input1" },
        { id: "e4-6", source: "4", target: "6", sourceHandle: "error", targetHandle: "input1" }
      ]
    };
    
    // Sauvegarder les templates
    fs.writeFileSync(path.join(templatesDir, 'hl7-to-fhir-simple.json'), JSON.stringify(hl7ToFhirTemplate, null, 2));
    fs.writeFileSync(path.join(templatesDir, 'sih-interface.json'), JSON.stringify(sihInterfaceTemplate, null, 2));
    fs.writeFileSync(path.join(templatesDir, 'patient-data-extraction.json'), JSON.stringify(patientDataTemplate, null, 2));
    fs.writeFileSync(path.join(templatesDir, 'dmp-interoperability.json'), JSON.stringify(dmpTemplate, null, 2));
    
    console.log('[WORKFLOW] Templates par défaut créés avec succès');
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la création des templates par défaut:', error);
    throw error;
  }
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
  getWorkflowTemplates,
  getWorkflowTemplateById,
  // Cette fonction n'est plus disponible mais est maintenue pour la compatibilité
  getRedApp: () => null
};