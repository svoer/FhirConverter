/**
 * Gestionnaire d'exécution de workflows
 * Ce fichier contient les fonctions pour exécuter et visualiser les exécutions
 * de workflows dans l'interface utilisateur
 */

// Gestionnaire d'exécution de workflow
const workflowExecutionManager = {
  // Exécute un workflow via l'API et retourne les résultats
  executeWorkflow: async function(workflowId, inputContent, options = {}) {
    try {
      const payload = {
        workflowId: workflowId,
        input: inputContent,
        options: options
      };

      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
          'X-API-KEY': 'dev-key'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'exécution du workflow');
      }

      const result = await response.json();
      return {
        success: true,
        execution: result.data,
        message: result.message || 'Exécution réussie'
      };
    } catch (error) {
      console.error('Erreur d\'exécution:', error);
      return {
        success: false,
        error: error.message || 'Une erreur est survenue lors de l\'exécution'
      };
    }
  },

  // Récupère l'historique des exécutions pour un workflow
  getExecutionHistory: async function(workflowId) {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/executions`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'X-API-KEY': 'dev-key'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération de l\'historique d\'exécutions');
      }

      const result = await response.json();
      return {
        success: true,
        history: result.data || []
      };
    } catch (error) {
      console.error('Erreur historique:', error);
      return {
        success: false,
        error: error.message || 'Une erreur est survenue'
      };
    }
  }
};

// Fonction pour créer une visualisation d'exécution
function createExecutionVisualization(containerId, executionData) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Conteneur ${containerId} non trouvé`);
    return;
  }

  // Structure de base pour la visualisation
  let htmlContent = `
    <div class="execution-results">
      <div class="execution-header">
        <h3>Résultats de l'exécution</h3>
        <div class="execution-stats">
          <span class="stat-item">
            <i class="fas fa-clock"></i> Durée: ${executionData.duration || 0}ms
          </span>
          <span class="stat-item">
            <i class="fas fa-cubes"></i> Nœuds: ${executionData.nodeCount || 0}
          </span>
          <span class="stat-item status-${executionData.status === 'success' ? 'success' : 'error'}">
            <i class="fas fa-${executionData.status === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            Statut: ${executionData.status === 'success' ? 'Succès' : 'Échec'}
          </span>
        </div>
      </div>
  `;

  // Si nous avons des étapes d'exécution, les afficher
  if (executionData.steps && executionData.steps.length > 0) {
    htmlContent += `<div class="execution-steps">`;
    
    executionData.steps.forEach((step, index) => {
      const isSuccess = step.status === 'success';
      const statusClass = isSuccess ? 'success' : 'error';
      
      htmlContent += `
        <div class="execution-step status-${statusClass}">
          <div class="step-header">
            <span class="step-number">${index + 1}</span>
            <span class="step-title">${step.nodeName || 'Étape sans nom'}</span>
            <span class="step-status">
              <i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}"></i>
              ${isSuccess ? 'Succès' : 'Échec'}
            </span>
          </div>
          <div class="step-details">
            <div class="step-timing">Durée: ${step.duration || 0}ms</div>
            ${step.message ? `<div class="step-message">${step.message}</div>` : ''}
          </div>
      `;

      // Afficher les données d'entrée
      if (step.input) {
        htmlContent += `
          <div class="step-io-container">
            <div class="step-io-header input"><i class="fas fa-sign-in-alt"></i> Entrée</div>
            <pre class="step-io-content">${formatIOData(step.input)}</pre>
          </div>
        `;
      }

      // Afficher les données de sortie si disponibles
      if (step.output) {
        htmlContent += `
          <div class="step-io-container">
            <div class="step-io-header output"><i class="fas fa-sign-out-alt"></i> Sortie</div>
            <pre class="step-io-content">${formatIOData(step.output)}</pre>
          </div>
        `;
      }

      htmlContent += `</div>`;  // Fin de l'étape
    });
    
    htmlContent += `</div>`;  // Fin des étapes
  } else if (executionData.message) {
    // Si pas d'étapes mais un message global
    htmlContent += `
      <div class="execution-message">
        <p>${executionData.message}</p>
      </div>
    `;
  }

  // Résultat final de l'exécution
  if (executionData.result) {
    htmlContent += `
      <div class="execution-result">
        <div class="result-header">
          <h4><i class="fas fa-flag-checkered"></i> Résultat final</h4>
        </div>
        <pre class="result-content">${formatIOData(executionData.result)}</pre>
      </div>
    `;
  }

  htmlContent += `</div>`;  // Fin des résultats d'exécution

  // Mettre à jour le conteneur
  container.innerHTML = htmlContent;
  container.style.display = 'block';
}

// Fonction utilitaire pour formater les données d'entrée/sortie
function formatIOData(data) {
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      console.error('Erreur lors du formatage des données:', e);
      return String(data);
    }
  }
  return String(data);
}

// Initialisation au chargement du document
document.addEventListener('DOMContentLoaded', function() {
  const testContainer = document.getElementById('test-workflow-container');
  const closeTestBtn = document.getElementById('close-test-container');
  
  // Gestionnaire pour fermer la section de test
  if (closeTestBtn) {
    closeTestBtn.addEventListener('click', function() {
      testContainer.style.display = 'none';
    });
  }
  
  // Gestionnaire de changement de type d'entrée
  const inputTypeSelect = document.getElementById('test-input-type');
  if (inputTypeSelect) {
    inputTypeSelect.addEventListener('change', function() {
      const inputContent = document.getElementById('test-input-content');
      
      // Si le type d'entrée est "sample", charger un exemple
      if (this.value === 'sample') {
        inputContent.value = 
          'MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20110614075841||ADT^A01|1407511|P|2.5.1|||AL|NE|||||\\r\\n' +
          'EVN|A01|20110614075841|||||\\r\\n' +
          'PID|1||10006579^^^1^MR^1||DUCK^DONALD^D||19241010|M||1|111 DUCK ST^^FOWL^CA^99999^USA|1|8885551212|8885551212|1|2|999-99-9999|||1^^^^^|||||||||||||||||||\\r\\n' +
          'PV1|1|I|ER^^^1^1^^^ER|3|||12345^DUCK^DONALD^D^^^^^^&1.2.840.113619.6.197&ISO^L^^^NPI^L^^^NPI|||||||||||||1|||||||||||||||||||||||||20110614075841|||||||||';
      } else if (this.value === 'text' && inputContent.value === '') {
        inputContent.value = '';
      }
    });
  }
});