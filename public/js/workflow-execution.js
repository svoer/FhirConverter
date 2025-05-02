/**
 * Workflow Execution
 * Ce fichier contient les fonctions pour l'exécution, le monitoring et les tests
 * des workflows HL7 vers FHIR
 */

// Classe pour gérer les exécutions de workflows
class WorkflowExecutionManager {
  constructor() {
    this.activeExecutions = new Map();
    this.executionHistory = [];
    this.listeners = new Map();
  }

  // Lancer une exécution de workflow
  async executeWorkflow(workflowId, inputData, options = {}) {
    const executionId = `exec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Créer un nouvel objet d'exécution
    const execution = {
      id: executionId,
      workflowId,
      startTime: new Date(),
      endTime: null,
      status: 'running',
      progress: 0,
      nodes: {},
      input: inputData,
      output: null,
      logs: [],
      error: null,
      options
    };
    
    // Ajouter l'exécution à la liste des exécutions actives
    this.activeExecutions.set(executionId, execution);
    
    // Notifier les listeners qu'une nouvelle exécution a démarré
    this._notifyListeners('execution-started', execution);
    
    try {
      // Appeler l'API pour exécuter le workflow
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` || `X-API-KEY: dev-key`
        },
        body: JSON.stringify({
          input: inputData,
          options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }
      
      // Traiter la réponse
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Erreur lors de l\'exécution du workflow');
      }
      
      // Mettre à jour l'exécution avec les résultats
      execution.endTime = new Date();
      execution.status = 'completed';
      execution.progress = 100;
      execution.output = result.data.output;
      execution.logs = result.data.logs || [];
      execution.executionTime = result.data.executionTime;
      
      // Mettre à jour les statistiques des nœuds
      if (result.data.nodes) {
        execution.nodes = result.data.nodes;
      }
      
      // Mettre à jour l'exécution dans la liste
      this.activeExecutions.set(executionId, execution);
      
      // Notifier les listeners que l'exécution est terminée
      this._notifyListeners('execution-completed', execution);
      
      // Ajouter cette exécution à l'historique
      this._addToHistory(execution);
      
      return {
        success: true,
        executionId,
        execution
      };
    } catch (error) {
      // Gérer les erreurs
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = error.message;
      
      // Mettre à jour l'exécution dans la liste
      this.activeExecutions.set(executionId, execution);
      
      // Notifier les listeners que l'exécution a échoué
      this._notifyListeners('execution-failed', execution);
      
      // Ajouter cette exécution à l'historique
      this._addToHistory(execution);
      
      return {
        success: false,
        executionId,
        execution,
        error: error.message
      };
    }
  }
  
  // Arrêter une exécution en cours
  async stopExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    
    if (!execution || execution.status !== 'running') {
      return {
        success: false,
        message: `L'exécution ${executionId} n'est pas en cours`
      };
    }
    
    try {
      // Appeler l'API pour arrêter l'exécution
      const response = await fetch(`/api/workflows/executions/${executionId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` || `X-API-KEY: dev-key`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Erreur lors de l\'arrêt de l\'exécution');
      }
      
      // Mettre à jour l'exécution
      execution.endTime = new Date();
      execution.status = 'stopped';
      
      // Mettre à jour l'exécution dans la liste
      this.activeExecutions.set(executionId, execution);
      
      // Notifier les listeners que l'exécution a été arrêtée
      this._notifyListeners('execution-stopped', execution);
      
      // Ajouter cette exécution à l'historique
      this._addToHistory(execution);
      
      return {
        success: true,
        execution
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Récupérer une exécution par son ID
  getExecution(executionId) {
    // Vérifier d'abord dans les exécutions actives
    if (this.activeExecutions.has(executionId)) {
      return this.activeExecutions.get(executionId);
    }
    
    // Sinon, chercher dans l'historique
    return this.executionHistory.find(execution => execution.id === executionId);
  }
  
  // Récupérer toutes les exécutions actives
  getAllActiveExecutions() {
    return Array.from(this.activeExecutions.values());
  }
  
  // Récupérer l'historique des exécutions
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(0, limit);
  }
  
  // Récupérer les exécutions pour un workflow spécifique
  getExecutionsByWorkflow(workflowId, limit = 10) {
    return this.executionHistory
      .filter(execution => execution.workflowId === workflowId)
      .slice(0, limit);
  }
  
  // Ajouter un listener pour les événements d'exécution
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
  }
  
  // Supprimer un listener
  removeListener(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbackIndex = this.listeners.get(event).indexOf(callback);
    if (callbackIndex !== -1) {
      this.listeners.get(event).splice(callbackIndex, 1);
    }
  }
  
  // Notifier les listeners d'un événement
  _notifyListeners(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erreur dans le listener pour l'événement ${event}:`, error);
      }
    });
  }
  
  // Ajouter une exécution à l'historique
  _addToHistory(execution) {
    // Supprimer l'exécution des actives si elle y est
    if (this.activeExecutions.has(execution.id)) {
      this.activeExecutions.delete(execution.id);
    }
    
    // Ajouter à l'historique (au début pour avoir les plus récentes en premier)
    this.executionHistory.unshift(execution);
    
    // Limiter la taille de l'historique (max 100 entrées)
    if (this.executionHistory.length > 100) {
      this.executionHistory.pop();
    }
    
    // Notifier les listeners que l'historique a été mis à jour
    this._notifyListeners('history-updated', this.executionHistory);
  }
  
  // Récupérer l'historique depuis le serveur
  async fetchExecutionHistory(workflowId = null, limit = 50) {
    try {
      const url = workflowId 
        ? `/api/workflows/${workflowId}/executions?limit=${limit}` 
        : `/api/workflows/executions?limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` || `X-API-KEY: dev-key`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Erreur lors de la récupération de l\'historique');
      }
      
      // Mettre à jour l'historique
      this.executionHistory = result.data;
      
      // Notifier les listeners que l'historique a été mis à jour
      this._notifyListeners('history-updated', this.executionHistory);
      
      return {
        success: true,
        history: this.executionHistory
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Créer une instance du gestionnaire d'exécution
const workflowExecutionManager = new WorkflowExecutionManager();

// Fonction pour créer l'interface de visualisation des exécutions
function createExecutionVisualization(containerId, execution) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Effacer le contenu actuel
  container.innerHTML = '';
  
  // Créer l'en-tête de visualisation
  const header = document.createElement('div');
  header.className = 'execution-header';
  
  // Déterminer la classe de statut
  let statusClass = '';
  let statusIcon = '';
  
  switch (execution.status) {
    case 'running':
      statusClass = 'status-running';
      statusIcon = '<i class="fas fa-spinner fa-spin"></i>';
      break;
    case 'completed':
      statusClass = 'status-completed';
      statusIcon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'failed':
      statusClass = 'status-failed';
      statusIcon = '<i class="fas fa-times-circle"></i>';
      break;
    case 'stopped':
      statusClass = 'status-stopped';
      statusIcon = '<i class="fas fa-stop-circle"></i>';
      break;
    default:
      statusClass = 'status-unknown';
      statusIcon = '<i class="fas fa-question-circle"></i>';
  }
  
  header.innerHTML = `
    <div class="execution-title">
      <span class="execution-id">Exécution #${execution.id.substring(5, 13)}</span>
      <span class="execution-status ${statusClass}">${statusIcon} ${execution.status}</span>
    </div>
    <div class="execution-meta">
      <span class="execution-time">
        <i class="far fa-clock"></i> 
        Démarré le ${execution.startTime.toLocaleString()}
        ${execution.endTime ? ` - Terminé le ${execution.endTime.toLocaleString()}` : ''}
      </span>
      ${execution.executionTime ? `<span class="execution-duration"><i class="fas fa-stopwatch"></i> Durée: ${execution.executionTime} ms</span>` : ''}
    </div>
  `;
  
  container.appendChild(header);
  
  // Créer la visualisation du workflow
  const visualizationContainer = document.createElement('div');
  visualizationContainer.className = 'execution-visualization';
  container.appendChild(visualizationContainer);
  
  // Ajouter les onglets
  const tabs = document.createElement('div');
  tabs.className = 'execution-tabs';
  tabs.innerHTML = `
    <div class="execution-tab active" data-tab="details">Détails</div>
    <div class="execution-tab" data-tab="logs">Logs</div>
    <div class="execution-tab" data-tab="input">Entrée</div>
    <div class="execution-tab" data-tab="output">Sortie</div>
  `;
  
  container.appendChild(tabs);
  
  // Ajouter le contenu des onglets
  const tabContents = document.createElement('div');
  tabContents.className = 'execution-tab-contents';
  
  // Onglet détails
  const detailsTab = document.createElement('div');
  detailsTab.className = 'execution-tab-content active';
  detailsTab.id = 'details-tab';
  
  if (execution.nodes && Object.keys(execution.nodes).length > 0) {
    const nodesTable = document.createElement('table');
    nodesTable.className = 'nodes-table';
    nodesTable.innerHTML = `
      <thead>
        <tr>
          <th>Nœud</th>
          <th>Statut</th>
          <th>Durée</th>
          <th>Entrées</th>
          <th>Sorties</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(execution.nodes).map(([nodeId, nodeData]) => `
          <tr>
            <td>${nodeData.label || nodeId}</td>
            <td class="status-${nodeData.status || 'unknown'}">${nodeData.status || 'Inconnu'}</td>
            <td>${nodeData.executionTime ? `${nodeData.executionTime} ms` : '-'}</td>
            <td>${nodeData.inputCount || 0}</td>
            <td>${nodeData.outputCount || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    detailsTab.appendChild(nodesTable);
  } else {
    detailsTab.innerHTML = '<p class="no-data">Aucun détail d\'exécution disponible</p>';
  }
  
  tabContents.appendChild(detailsTab);
  
  // Onglet logs
  const logsTab = document.createElement('div');
  logsTab.className = 'execution-tab-content';
  logsTab.id = 'logs-tab';
  
  if (execution.logs && execution.logs.length > 0) {
    const logsContainer = document.createElement('div');
    logsContainer.className = 'logs-container';
    
    execution.logs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry log-${log.level || 'info'}`;
      logEntry.innerHTML = `
        <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
        <span class="log-level">[${log.level || 'INFO'}]</span>
        <span class="log-message">${log.message}</span>
      `;
      logsContainer.appendChild(logEntry);
    });
    
    logsTab.appendChild(logsContainer);
  } else {
    logsTab.innerHTML = '<p class="no-data">Aucun log disponible</p>';
  }
  
  tabContents.appendChild(logsTab);
  
  // Onglet entrée
  const inputTab = document.createElement('div');
  inputTab.className = 'execution-tab-content';
  inputTab.id = 'input-tab';
  
  if (execution.input) {
    const inputPre = document.createElement('pre');
    inputPre.className = 'code-display';
    
    try {
      // Si l'entrée est un objet, afficher au format JSON
      if (typeof execution.input === 'object') {
        inputPre.innerHTML = JSON.stringify(execution.input, null, 2);
      } else {
        inputPre.innerHTML = execution.input;
      }
    } catch (error) {
      inputPre.innerHTML = `Erreur lors de l'affichage de l'entrée: ${error.message}`;
    }
    
    inputTab.appendChild(inputPre);
  } else {
    inputTab.innerHTML = '<p class="no-data">Aucune donnée d\'entrée disponible</p>';
  }
  
  tabContents.appendChild(inputTab);
  
  // Onglet sortie
  const outputTab = document.createElement('div');
  outputTab.className = 'execution-tab-content';
  outputTab.id = 'output-tab';
  
  if (execution.output) {
    const outputPre = document.createElement('pre');
    outputPre.className = 'code-display';
    
    try {
      // Si la sortie est un objet, afficher au format JSON
      if (typeof execution.output === 'object') {
        outputPre.innerHTML = JSON.stringify(execution.output, null, 2);
      } else {
        outputPre.innerHTML = execution.output;
      }
    } catch (error) {
      outputPre.innerHTML = `Erreur lors de l'affichage de la sortie: ${error.message}`;
    }
    
    outputTab.appendChild(outputPre);
  } else if (execution.status === 'running') {
    outputTab.innerHTML = '<p class="no-data">Exécution en cours, veuillez patienter...</p>';
  } else if (execution.status === 'failed') {
    outputTab.innerHTML = `<p class="error-message">Erreur: ${execution.error || 'Erreur inconnue'}</p>`;
  } else {
    outputTab.innerHTML = '<p class="no-data">Aucune donnée de sortie disponible</p>';
  }
  
  tabContents.appendChild(outputTab);
  
  container.appendChild(tabContents);
  
  // Ajouter les interactions aux onglets
  const tabElements = tabs.querySelectorAll('.execution-tab');
  tabElements.forEach(tab => {
    tab.addEventListener('click', function() {
      // Désactiver tous les onglets et contenus
      tabs.querySelectorAll('.execution-tab').forEach(t => t.classList.remove('active'));
      tabContents.querySelectorAll('.execution-tab-content').forEach(c => c.classList.remove('active'));
      
      // Activer l'onglet cliqué
      this.classList.add('active');
      
      // Activer le contenu correspondant
      const tabId = this.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Exporter les fonctions et classes
window.WorkflowExecutionManager = WorkflowExecutionManager;
window.workflowExecutionManager = workflowExecutionManager;
window.createExecutionVisualization = createExecutionVisualization;