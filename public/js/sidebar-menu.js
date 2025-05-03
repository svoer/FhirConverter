// Menu latéral et recherche globale pour FHIRHub

document.addEventListener('DOMContentLoaded', function() {
  // Récupérer les éléments DOM
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  const footer = document.querySelector('.footer');
  const mobileToggle = document.getElementById('sidebar-toggle-mobile');
  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  
  // Structure de navigation pour la recherche
  const navigationItems = [
    { title: 'Tableau de bord', url: '/dashboard.html', category: 'Principal', keywords: ['accueil', 'statistiques', 'dashboard'] },
    { title: 'Conversion HL7 vers FHIR', url: '/convert.html', category: 'Conversion', keywords: ['conversion', 'transformer', 'hl7', 'fhir'] },
    { title: 'Applications', url: '/applications.html', category: 'Administration', keywords: ['apps', 'client'] },
    { title: 'Clés API', url: '/api-keys.html', category: 'Administration', keywords: ['api', 'clés', 'security', 'access'] },
    { title: 'Utilisateurs', url: '/users.html', category: 'Administration', keywords: ['users', 'comptes', 'permissions'] },
    { title: 'Terminologies', url: '/terminologies.html', category: 'Configuration', keywords: ['codes', 'mapping', 'nomenclature'] },
    { title: 'Workflows', url: '/workflows.html', category: 'Configuration', keywords: ['processus', 'automatisation', 'flux'] },
    { title: 'Paramètres IA', url: '/ai-settings.html', category: 'Configuration', keywords: ['intelligence artificielle', 'mistral', 'chatbot'] },
    { title: 'Documentation', url: '/documentation.html', category: 'Ressources', keywords: ['aide', 'docs', 'guide'] },
    { title: 'API Reference', url: '/api-docs/', category: 'Ressources', keywords: ['api', 'développeurs', 'integration'] },
  ];

  // Fonction pour basculer l'état du menu latéral
  function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    if (footer) footer.classList.toggle('expanded');
    
    // Sauvegarder l'état dans localStorage
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    
    // Mettre à jour les icônes du bouton toggle
    updateToggleIcon();
  }
  
  // Mettre à jour l'icône du bouton toggle
  function updateToggleIcon() {
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (menuToggle) {
      // Remplacer l'icône en fonction de l'état
      menuToggle.innerHTML = isCollapsed ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
      menuToggle.setAttribute('title', isCollapsed ? 'Ouvrir le menu' : 'Fermer le menu');
    }
    
    if (mobileToggle) {
      mobileToggle.innerHTML = '<i class="fas fa-' + (isCollapsed ? 'bars' : 'times') + '"></i>';
    }
  }
  
  // Initialiser l'état du menu à partir de localStorage
  function initSidebarState() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      mainContent.classList.add('expanded');
      if (footer) footer.classList.add('expanded');
    }
    
    updateToggleIcon();
    
    // Ajouter des classes pour animer les éléments du menu
    const menuItems = document.querySelectorAll('.nav-menu a');
    menuItems.forEach((item, index) => {
      item.style.setProperty('--index', index);
    });
  }
  
  // Fonction de recherche globale
  function performSearch(query) {
    if (!query || query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }
    
    query = query.toLowerCase().trim();
    const matches = [];
    
    // Recherche dans les éléments de navigation
    navigationItems.forEach(item => {
      const titleMatch = item.title.toLowerCase().includes(query);
      const keywordMatch = item.keywords.some(keyword => keyword.toLowerCase().includes(query));
      
      if (titleMatch || keywordMatch) {
        matches.push(item);
      }
    });
    
    // Afficher les résultats
    displaySearchResults(matches, query);
  }
  
  // Afficher les résultats de recherche
  function displaySearchResults(matches, query) {
    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
      searchResults.classList.add('active');
      return;
    }
    
    let resultsHTML = '';
    
    matches.forEach(match => {
      const title = highlightMatch(match.title, query);
      
      resultsHTML += `
        <div class="search-result-item" data-url="${match.url}">
          <div class="result-title">${title}</div>
          <div class="result-category">${match.category}</div>
        </div>
      `;
    });
    
    searchResults.innerHTML = resultsHTML;
    searchResults.classList.add('active');
    
    // Ajouter des écouteurs d'événements pour les résultats
    document.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function() {
        window.location.href = this.getAttribute('data-url');
      });
    });
  }
  
  // Surligner la partie correspondante dans le texte
  function highlightMatch(text, query) {
    const regex = new RegExp('(' + query + ')', 'gi');
    return text.replace(regex, '<span class="result-match">$1</span>');
  }
  
  // Associer les écouteurs d'événements
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
  }
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      sidebar.classList.toggle('mobile-open');
      this.innerHTML = sidebar.classList.contains('mobile-open') ? 
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
  }
  
  if (searchInput) {
    // Recherche en temps réel avec debounce
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(this.value);
      }, 300);
    });
    
    // Fermer les résultats lors d'un clic à l'extérieur
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('active');
      }
    });
    
    // Naviguer dans les résultats avec le clavier
    searchInput.addEventListener('keydown', function(e) {
      const results = document.querySelectorAll('.search-result-item');
      
      if (e.key === 'Enter' && results.length > 0) {
        window.location.href = results[0].getAttribute('data-url');
      }
    });
  }
  
  // Identifier la page active et ajouter la classe .active
  function setActivePage() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.nav-menu a');
    
    menuLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
  }
  
  // Initialiser l'état du menu
  initSidebarState();
  
  // Définir la page active
  setActivePage();
});