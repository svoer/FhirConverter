/**
 * Script principal d'initialisation pour FHIRHub
 * Gère la navigation entre les onglets et l'initialisation des composants
 */

(function() {
  'use strict';
  
  // Objets pour stocker les états des différents modules
  const state = {
    currentTab: null,
    modulesInitialized: {
      apiTester: false,
      applications: false
    }
  };
  
  // Initialisation au chargement de la page
  document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la navigation et les onglets
    initTabNavigation();
    
    // Activer l'onglet par défaut (convertisseur)
    const defaultTab = document.querySelector('.tab[data-tab="convert"]');
    if (defaultTab) defaultTab.click();
    
    console.log('FHIRHub Interface initialisée');
  });
  
  // Initialiser la navigation par onglets
  function initTabNavigation() {
    // Ajouter les événements de clic aux onglets
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', function() {
        // Ne pas continuer si l'onglet est déjà actif
        if (this.classList.contains('active')) return;
        
        // Supprimer la classe active de tous les onglets
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        
        // Ajouter la classe active à l'onglet cliqué
        this.classList.add('active');
        
        // Masquer tous les contenus d'onglet
        document.querySelectorAll('.tab-content').forEach(content => {
          content.style.display = 'none';
        });
        
        // Afficher le contenu de l'onglet cliqué
        const tabId = this.getAttribute('data-tab');
        const tabContent = document.getElementById(tabId + '-tab');
        if (tabContent) {
          tabContent.style.display = 'block';
          state.currentTab = tabId;
          
          // Initialiser le module spécifique à l'onglet si nécessaire
          initModuleForTab(tabId);
        }
      });
    });
  }
  
  // Initialiser les modules spécifiques à chaque onglet
  function initModuleForTab(tabId) {
    switch (tabId) {
      case 'api-tester':
        if (!state.modulesInitialized.apiTester) {
          console.log('Initialisation du module testeur d\'API');
          
          // Vérifie si la fonction d'initialisation existe
          if (typeof window.initializeApiTesterTab === 'function') {
            window.initializeApiTesterTab();
            state.modulesInitialized.apiTester = true;
          } else {
            console.error('Fonction initializeApiTesterTab non trouvée');
          }
        }
        break;
        
      case 'applications':
        if (!state.modulesInitialized.applications) {
          console.log('Initialisation du module applications');
          
          // Vérifie si la fonction d'initialisation existe
          if (typeof window.initApplicationsTab === 'function') {
            window.initApplicationsTab();
            state.modulesInitialized.applications = true;
          } else {
            console.error('Fonction initApplicationsTab non trouvée');
          }
        }
        break;
        
      // Ajouter d'autres cas pour les autres onglets au besoin
    }
  }
  
  // Exposer quelques fonctions utiles globalement
  window.refreshAllTabs = function() {
    // Rafraîchir tous les composants de l'interface
    console.log('Rafraîchissement de tous les composants');
    
    // Rafraîchir les statistiques si disponible
    if (typeof refreshStats === 'function') {
      refreshStats();
    }
    
    // Rafraîchir l'historique si disponible
    if (typeof refreshHistory === 'function') {
      refreshHistory();
    }
    
    // Rafraîchir les applications si l'onglet est initialisé
    if (state.modulesInitialized.applications && typeof refreshApplications === 'function') {
      refreshApplications();
    }
    
    // Rafraîchir le testeur d'API si l'onglet est initialisé
    if (state.modulesInitialized.apiTester && typeof loadApplications === 'function') {
      loadApplications();
    }
  };
  
  // Cette fonction sera appelée quand certains événements nécessitent
  // un rafraîchissement de l'interface (création d'application, etc.)
  window.refreshCurrentTab = function() {
    switch (state.currentTab) {
      case 'applications':
        if (typeof refreshApplications === 'function') {
          refreshApplications();
        }
        break;
        
      case 'api-tester':
        if (typeof loadApplications === 'function') {
          loadApplications();
        }
        break;
        
      case 'history':
        if (typeof refreshHistory === 'function') {
          refreshHistory();
        }
        break;
    }
  };
})();