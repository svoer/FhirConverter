// Script pour inclure le menu latéral dans toutes les pages
// Utiliser une fonction immédiatement invoquée pour protéger le scope
(function() {
  // Attendre que le DOM soit complètement chargé
  document.addEventListener('DOMContentLoaded', function() {
    // Ne pas exécuter pour la page de login ou index
    if (window.location.pathname === '/login.html' || window.location.pathname === '/index.html') {
      return;
    }
    
    // Variable pour éviter les boucles infinies
    if (window.sidebarLoaded) return;
    window.sidebarLoaded = true;
    
    console.log('Chargement du menu latéral...');
    
    // Récupérer l'élément où insérer le sidebar (inséré au début du body)
    const targetElement = document.body;
    
    // Supprimer d'abord tout header existant
    const existingHeader = document.querySelector('header.header');
    if (existingHeader) {
      existingHeader.parentNode.removeChild(existingHeader);
    }
    
    // Supprimer tout sidebar existant
    const existingSidebar = document.querySelector('aside.sidebar');
    if (existingSidebar) {
      existingSidebar.parentNode.removeChild(existingSidebar);
    }
    
    // Supprimer tout bouton mobile existant
    const existingMobileToggle = document.querySelector('#sidebar-toggle-mobile');
    if (existingMobileToggle) {
      existingMobileToggle.parentNode.removeChild(existingMobileToggle);
    }
    
    // Charger le contenu du fichier sidebar.html
    fetch('/includes/sidebar.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('Erreur de chargement du menu latéral');
        }
        return response.text();
      })
      .then(html => {
        // Créer un conteneur temporaire pour parser le HTML
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = html;
        
        // Insérer les éléments du sidebar au début du body
        const nodes = Array.from(tempContainer.childNodes);
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].nodeType === 1) { // Seulement les éléments, pas les nœuds texte
            targetElement.insertBefore(nodes[i], targetElement.firstChild);
          }
        }
        
        // Référence au contenu principal
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) {
          // Créer un élément main-content s'il n'existe pas
          const newMainContent = document.createElement('div');
          newMainContent.className = 'main-content';
          
          // Déplacer tous les éléments existants sauf le header et le sidebar dans main-content
          const elementsToMove = [];
          for (let i = 0; i < targetElement.children.length; i++) {
            const child = targetElement.children[i];
            if (child.tagName !== 'HEADER' && 
                child.tagName !== 'ASIDE' && 
                child !== existingMobileToggle &&
                !child.classList.contains('main-content') &&
                !child.classList.contains('footer')) {
              elementsToMove.push(child);
            }
          }
          
          for (const element of elementsToMove) {
            newMainContent.appendChild(element);
          }
          
          // Insérer le nouveau main-content après le sidebar
          const sidebar = document.querySelector('aside.sidebar');
          if (sidebar && sidebar.nextSibling) {
            targetElement.insertBefore(newMainContent, sidebar.nextSibling);
          } else {
            targetElement.appendChild(newMainContent);
          }
        }
        
        console.log('Menu latéral chargé avec succès');
        
        // Initialiser le menu latéral avec un délai sécuritaire
        setTimeout(setupSidebarInteractivity, 300);
      })
      .catch(error => {
        console.error('Erreur lors du chargement du menu latéral:', error);
      });
  });
  
  // Fonction pour configurer l'interactivité du menu une fois chargé
  function setupSidebarInteractivity() {
    console.log('Configuration de l\'interactivité du menu latéral...');
    
    // Bascule du menu latéral
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const footer = document.querySelector('.footer');
    
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        if (mainContent) mainContent.classList.toggle('expanded');
        if (footer) footer.classList.toggle('expanded');
      });
      console.log('Événement de bascule du menu configuré');
    } else {
      console.warn('Éléments de bascule du menu non trouvés');
    }
    
    // Menu mobile
    const mobileToggle = document.getElementById('sidebar-toggle-mobile');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', function() {
        sidebar.classList.toggle('mobile-open');
        this.innerHTML = sidebar.classList.contains('mobile-open') ? 
          '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
      });
      console.log('Événement de menu mobile configuré');
    } else {
      console.warn('Éléments de menu mobile non trouvés');
    }
    
    // Marquer la page active dans le menu
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.nav-menu a');
    if (menuLinks.length > 0) {
      menuLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
          link.classList.add('active');
        }
      });
      console.log('Page active marquée dans le menu');
    }
    
    // Gestion des favoris
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    if (favoriteButtons.length > 0) {
      favoriteButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const url = this.getAttribute('data-url');
          this.classList.toggle('active');
          
          if (this.classList.contains('active')) {
            this.innerHTML = '<i class="fas fa-star"></i>';
          } else {
            this.innerHTML = '<i class="far fa-star"></i>';
          }
        });
      });
      console.log('Événements de favoris configurés');
    }
    
    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
      });
      console.log('Événement de déconnexion configuré');
    } else {
      console.warn('Bouton de déconnexion non trouvé');
    }
    
    console.log('Configuration de l\'interactivité terminée');
  }
})();