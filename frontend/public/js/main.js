/**
 * Script principal de l'interface FHIRHub
 * Gère les fonctionnalités communes et la navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialiser la navigation par onglets
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Fonction pour changer d'onglet
  function switchTab(tabId) {
    // Désactiver tous les onglets
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Désactiver tous les contenus d'onglets
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    const selectedTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
    
    // Activer le contenu d'onglet sélectionné
    const selectedContent = document.getElementById(`${tabId}-tab`);
    if (selectedContent) {
      selectedContent.classList.add('active');
      
      // Initialiser le testeur d'API si c'est l'onglet actif
      if (tabId === 'test-api' && typeof initializeApiTesterTab === 'function') {
        console.log('Initialisation du testeur d\'API depuis le changement d\'onglet');
        initializeApiTesterTab();
      }
    }
    
    // Sauvegarder l'onglet actif dans le localStorage
    localStorage.setItem('activeTab', tabId);
  }
  
  // Ajouter les gestionnaires d'événements pour les onglets
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
  
  // Restaurer l'onglet actif depuis le localStorage ou utiliser l'onglet par défaut
  const activeTab = localStorage.getItem('activeTab') || 'dashboard';
  switchTab(activeTab);
});