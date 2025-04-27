/**
 * Script de correctif pour les endpoints d'API
 * Permet de remplir correctement les champs lors du clic sur un endpoint
 */

(function() {
  'use strict';
  
  // Configuration
  const config = {
    selectors: {
      endpointBtns: '.endpoint-item',
      urlInput: 'endpoint-input',
      methodSelect: 'request-method',
      requestBody: 'request-body',
      endpointInfo: 'endpoint-info'
    },
    delay: 500 // Délai d'initialisation
  };
  
  // Fonctions utilitaires
  function log(message, data) {
    console.log(`[API-ENDPOINTS-FIX] ${message}`, data || '');
  }
  
  function error(message, data) {
    console.error(`[API-ENDPOINTS-FIX] ${message}`, data || '');
  }
  
  // Fonction pour initialiser les gestionnaires d'événements
  function initEndpointHandlers() {
    log('Initialisation des gestionnaires d\'événements pour les endpoints...');
    
    // Récupérer tous les boutons d'endpoint
    const endpointButtons = document.querySelectorAll(config.selectors.endpointBtns);
    
    if (!endpointButtons || endpointButtons.length === 0) {
      error('Aucun bouton d\'endpoint trouvé');
      
      // Réessayer après un délai
      setTimeout(initEndpointHandlers, 2000);
      return;
    }
    
    log(`${endpointButtons.length} boutons d'endpoint trouvés`);
    
    // Ajouter un gestionnaire pour chaque bouton
    endpointButtons.forEach(button => {
      // Vérifier si l'événement est déjà attaché
      if (button.getAttribute('data-handler-added')) {
        return;
      }
      
      button.addEventListener('click', function() {
        const method = this.getAttribute('data-method') || 'GET';
        const endpoint = this.getAttribute('data-endpoint') || '';
        const url = '/api/' + endpoint;
        const body = this.getAttribute('data-body') || '';
        const info = this.getAttribute('data-info') || '';
        
        log(`Endpoint cliqué: ${method} ${url}`);
        
        // Remplir le champ de méthode
        const methodSelect = document.getElementById(config.selectors.methodSelect);
        if (methodSelect) {
          methodSelect.value = method;
          log(`Méthode définie: ${method}`);
        } else {
          error('Sélecteur de méthode non trouvé');
        }
        
        // Remplir le champ d'URL
        const urlInput = document.getElementById(config.selectors.urlInput);
        if (urlInput) {
          urlInput.value = url;
          log(`URL définie: ${url}`);
        } else {
          error('Champ d\'URL non trouvé');
        }
        
        // Remplir l'éditeur JSON si nécessaire
        if (body && body !== '') {
          const requestBody = document.getElementById(config.selectors.requestBody);
          if (requestBody) {
            requestBody.value = body;
            log('Corps de requête défini');
          } else {
            error('Éditeur de corps de requête non trouvé');
          }
        }
        
        // Afficher les informations sur l'endpoint si disponibles
        if (info && info !== '') {
          const endpointInfo = document.getElementById(config.selectors.endpointInfo);
          if (endpointInfo) {
            endpointInfo.innerHTML = info;
            endpointInfo.style.display = 'block';
            log('Informations sur l\'endpoint affichées');
          }
        }
        
        // Forcer une mise à jour des événements d'entrée
        if (urlInput) {
          // Déclencher un événement de changement sur le champ d'URL
          const event = new Event('input', { bubbles: true });
          urlInput.dispatchEvent(event);
          log('Événement input déclenché sur le champ URL');
        }
        
        // Si c'est un POST/PUT/PATCH, activer l'onglet de corps de requête
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          const bodyTab = document.querySelector('.request-tab[data-tab="body"]');
          if (bodyTab) {
            bodyTab.click();
            log('Onglet de corps de requête activé');
          }
        }
      });
      
      // Marquer l'événement comme attaché
      button.setAttribute('data-handler-added', 'true');
      
      // Ajouter une classe pour indiquer que le bouton est actif
      button.classList.add('endpoint-btn-active');
    });
    
    log('Gestionnaires d\'événements pour les endpoints initialisés avec succès');
  }
  
  // Initialisation
  function initialize() {
    log('Initialisation du correctif pour les endpoints d\'API...');
    
    // Initialiser les gestionnaires d'événements
    initEndpointHandlers();
    
    // Réinitialiser les gestionnaires d'événements lors du changement d'onglet
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Réinitialiser les gestionnaires après un court délai pour assurer que le DOM est prêt
        setTimeout(initEndpointHandlers, 300);
      });
    });
    
    // Configurer un intervalle pour vérifier périodiquement les nouveaux boutons
    setInterval(initEndpointHandlers, 5000);
  }
  
  // Charger le script après que tout le DOM soit chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initialize, config.delay);
    });
  } else {
    setTimeout(initialize, config.delay);
  }
  
  // Exposer quelques fonctions pour le débogage
  window.apiEndpointsFix = {
    init: initialize,
    reinitHandlers: initEndpointHandlers
  };
})();