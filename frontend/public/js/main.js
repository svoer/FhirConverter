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
            
            // Charger explicitement les applications pour l'onglet API Tester
            // avec un délai pour s'assurer que tout est initialisé
            setTimeout(() => {
              if (typeof window.reloadApiTesterApplications === 'function') {
                window.reloadApiTesterApplications();
              }
            }, 500);
          } else {
            console.error('Fonction initializeApiTesterTab non trouvée');
          }
        } else {
          // Même si déjà initialisé, recharger les applications quand on 
          // revient à cet onglet
          if (typeof window.reloadApiTesterApplications === 'function') {
            window.reloadApiTesterApplications();
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
    if (state.modulesInitialized.apiTester) {
      if (typeof window.reloadApiTesterApplications === 'function') {
        window.reloadApiTesterApplications();
      } else if (typeof loadApplications === 'function') {
        loadApplications();
      }
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
  
  // Fonction ajoutée pour charger manuellement les applications dans l'onglet API Tester
  window.reloadApiTesterApplications = function() {
    // Assurons-nous que tous les éléments nécessaires sont disponibles
    const appSelect = document.getElementById('test-app-select');
    if (!appSelect) {
      console.error("Sélecteur d'applications non trouvé dans l'onglet API Tester");
      return;
    }
    
    console.log("Chargement manuel des applications pour l'onglet API Tester");
    
    // Afficher un message de chargement
    appSelect.innerHTML = '<option value="">Chargement...</option>';
    appSelect.disabled = true;
    
    // Effectuer une requête API directe pour obtenir les applications
    // Assurons-nous que la clé API est fournie
    const apiKey = localStorage.getItem('apiKey') || 'dev-key';
    fetch(`/api/applications?apiKey=${apiKey}`, {
        headers: {
          'x-api-key': apiKey
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(result => {
        // Réinitialiser le sélecteur
        appSelect.innerHTML = '<option value="">Sélectionnez une application</option>';
        appSelect.disabled = false;
        
        if (!result || !result.data) {
          console.error("Aucune donnée d'application reçue");
          return;
        }
        
        // Forcer la conversion en tableau si nécessaire
        const apps = Array.isArray(result.data) ? result.data : [result.data];
        
        // Créer les options pour chaque application
        apps.forEach(app => {
          if (!app || !app.id) return;
          
          const option = document.createElement('option');
          option.value = app.id;
          option.textContent = app.name || `Application #${app.id}`;
          appSelect.appendChild(option);
        });
        
        // Configurer l'événement de changement d'application pour charger les clés
        if (!appSelect.getAttribute('data-event-attached')) {
          appSelect.addEventListener('change', function() {
            const appId = this.value;
            if (appId) {
              window.loadApiKeys(appId);
            }
          });
          appSelect.setAttribute('data-event-attached', 'true');
        }
        
        console.log(`${apps.length} applications chargées avec succès`);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des applications:', error);
        appSelect.innerHTML = '<option value="">Erreur de chargement</option>';
        appSelect.disabled = false;
      });
  };
  
  // Fonction pour charger les clés API d'une application
  window.loadApiKeys = function(appId) {
    if (!appId) return;
    
    const keySelect = document.getElementById('test-key-select');
    if (!keySelect) {
      console.error("Sélecteur de clés API non trouvé");
      return;
    }
    
    // Message de chargement
    keySelect.innerHTML = '<option value="">Chargement...</option>';
    keySelect.disabled = true;
    
    // Effectuer la requête API avec authentification
    const apiKey = localStorage.getItem('apiKey') || 'dev-key';
    fetch(`/api/keys?appId=${appId}&apiKey=${apiKey}`, {
        headers: {
          'x-api-key': apiKey
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(result => {
        // Réinitialiser le sélecteur
        keySelect.innerHTML = '<option value="">Sélectionnez une clé API</option>';
        keySelect.disabled = false;
        
        if (!result || !result.data) {
          console.error("Aucune donnée de clé API reçue");
          keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
          return;
        }
        
        // Forcer la conversion en tableau si nécessaire
        const keys = Array.isArray(result.data) ? result.data : [result.data];
        
        if (keys.length === 0) {
          keySelect.innerHTML = '<option value="">Aucune clé disponible</option>';
          return;
        }
        
        // Ajouter les options
        keys.forEach(key => {
          if (!key) return;
          
          const keyValue = key.api_key || key.key || key.value;
          if (!keyValue) return;
          
          const option = document.createElement('option');
          option.value = keyValue;
          option.textContent = key.name || key.description || 'Clé API';
          keySelect.appendChild(option);
        });
        
        console.log(`${keys.length} clés API chargées`);
        
        // Configurer l'événement de changement de clé
        if (!keySelect.getAttribute('data-event-attached')) {
          keySelect.addEventListener('change', function() {
            // Mettre à jour l'en-tête API key si un élément avec cet ID existe
            const apiKeyHeader = document.getElementById('api-key-header');
            if (apiKeyHeader) {
              apiKeyHeader.value = this.value;
            }
          });
          keySelect.setAttribute('data-event-attached', 'true');
        }
      })
      .catch(error => {
        console.error('Erreur lors du chargement des clés API:', error);
        keySelect.innerHTML = '<option value="">Erreur de chargement</option>';
        keySelect.disabled = false;
      });
  };
})();