/**
 * Correctif pour la navigation entre les onglets
 * Ce module corrige le bug de rémanence dans la section historique
 * et améliore la navigation générale entre les onglets
 * 
 * @module tabNavigationFix
 * @author FHIRHub Team
 */

/**
 * Nettoyer le contenu des onglets inactifs
 * @param {string} activeTabId - ID de l'onglet actif
 */
function cleanupInactiveTabs(activeTabId) {
  // Liste des conteneurs de contenu à nettoyer lorsqu'ils sont inactifs
  const cleanableContainers = [
    'history-content',
    'conversion-result-container',
    'error-container'
  ];
  
  cleanableContainers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container && !container.closest(`#${activeTabId}`)) {
      // Si le conteneur n'est pas dans l'onglet actif, le vider
      container.innerHTML = '';
    }
  });
}

/**
 * Appliquer le correctif de navigation des onglets
 */
function applyTabNavigationFix() {
  console.log("Application du correctif de navigation des onglets");
  
  // Récupérer tous les onglets
  const tabs = document.querySelectorAll('[role="tab"]');
  
  // Appliquer le correctif à chaque onglet
  tabs.forEach(tab => {
    if (!tab.dataset.navFixed) {
      tab.dataset.navFixed = 'true';
      
      // Intercepter le clic sur l'onglet
      tab.addEventListener('click', function(e) {
        const targetId = this.getAttribute('aria-controls');
        
        // Nettoyer les onglets inactifs
        cleanupInactiveTabs(targetId);
        
        // Si c'est l'onglet historique, recharger l'historique
        if (targetId === 'history-tab') {
          // Vider d'abord le conteneur d'historique
          const historyContent = document.getElementById('history-content');
          if (historyContent) {
            historyContent.innerHTML = '';
          }
          
          // Déclencher la fonction de chargement d'historique si elle existe
          if (window.loadConversionHistory) {
            window.loadConversionHistory();
          }
        }
      });
    }
  });
}

/**
 * Initialiser le correctif de navigation
 */
function initTabNavigationFix() {
  // Appliquer le correctif immédiatement
  applyTabNavigationFix();
  
  // Observer les mutations du DOM pour les nouveaux onglets
  if (window.MutationObserver) {
    const observer = new MutationObserver(mutations => {
      let shouldApplyFix = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === 1 && (node.getAttribute('role') === 'tab' || 
                node.querySelector('[role="tab"]'))) {
              shouldApplyFix = true;
              break;
            }
          }
        }
      });
      
      if (shouldApplyFix) {
        applyTabNavigationFix();
      }
    });
    
    // Observer tout le document pour les nouveaux onglets
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-controls']
    });
  }
}

// Exportation des fonctions du module
window.tabNavigationFix = {
  init: initTabNavigationFix,
  apply: applyTabNavigationFix,
  cleanupInactiveTabs: cleanupInactiveTabs
};

// Appliquer le correctif au chargement de la page
document.addEventListener('DOMContentLoaded', initTabNavigationFix);