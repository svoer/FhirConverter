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
      // Récupérer les favoris actuels depuis localStorage
      let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      
      // Mettre à jour l'apparence des boutons en fonction des favoris enregistrés
      favoriteButtons.forEach(btn => {
        const url = btn.getAttribute('data-url');
        if (!url) {
          console.warn('Bouton favori sans attribut data-url trouvé');
          return; // Ignorer les boutons sans URL
        }
        
        if (favorites.includes(url)) {
          btn.classList.add('active');
          btn.innerHTML = '<i class="fas fa-star"></i>';
          btn.setAttribute('title', 'Retirer des favoris');
        }
        
        // Ajouter l'écouteur d'événement pour gérer les clics
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const url = this.getAttribute('data-url');
          if (!url) {
            console.warn('Clic sur un bouton favori sans attribut data-url');
            return; // Ne rien faire si pas d'URL
          }
          
          // Récupérer les favoris actuels
          let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
          
          // Vérifier si l'URL est déjà dans les favoris
          const index = favorites.indexOf(url);
          
          if (index === -1) {
            // Ajouter aux favoris
            favorites.push(url);
            this.classList.add('active');
            this.innerHTML = '<i class="fas fa-star"></i>';
            this.setAttribute('title', 'Retirer des favoris');
          } else {
            // Retirer des favoris
            favorites.splice(index, 1);
            this.classList.remove('active');
            this.innerHTML = '<i class="far fa-star"></i>';
            this.setAttribute('title', 'Ajouter aux favoris');
          }
          
          // Enregistrer les favoris mis à jour
          localStorage.setItem('favorites', JSON.stringify(favorites));
          
          // Mettre à jour l'affichage de la liste des favoris
          updateFavoritesList(favorites);
        });
      });
      
      // Initialiser la liste des favoris
      updateFavoritesList(favorites);
      
      console.log('Événements de favoris configurés');
    }
    
    // Fonction pour mettre à jour la liste des favoris dans le menu
    function updateFavoritesList(favorites) {
      const favoritesList = document.getElementById('favorites-list');
      if (!favoritesList) return;
      
      if (!favorites || favorites.length === 0) {
        favoritesList.innerHTML = '<li><p class="no-favorites">Aucun favori</p></li>';
        return;
      }
      
      // Récupérer la structure de navigation pour les étiquettes
      const navMap = {
        '/dashboard.html': { title: 'Tableau de bord', icon: 'fas fa-chart-line' },
        '/convert.html': { title: 'HL7 vers FHIR', icon: 'fas fa-exchange-alt' },
        '/applications.html': { title: 'Applications', icon: 'fas fa-th' },
        '/api-keys.html': { title: 'Clés API', icon: 'fas fa-key' },
        '/users.html': { title: 'Utilisateurs', icon: 'fas fa-users' },
        '/terminologies.html': { title: 'Terminologies', icon: 'fas fa-book-medical' },
        '/workflows.html': { title: 'Workflows', icon: 'fas fa-project-diagram' },
        '/ai-settings.html': { title: 'Paramètres IA', icon: 'fas fa-robot' },
        '/documentation.html': { title: 'Documentation', icon: 'fas fa-file-alt' },
        '/api-reference.html': { title: 'API Reference', icon: 'fas fa-code' },
        '/hl7-ai-assistant.html': { title: 'Assistant IA', icon: 'fas fa-robot' }
      };
      
      // Créer des éléments de menu pour chaque favori
      const items = favorites.map(url => {
        const navItem = navMap[url];
        if (!navItem) {
          console.warn(`Navigation item not found for URL: ${url}`);
          return '';
        }
        
        return `
          <li>
            <a href="${url}">
              <i class="${navItem.icon}"></i> ${navItem.title}
              <button class="favorite-btn active remove-favorite" data-url="${url}" title="Retirer des favoris">
                <i class="fas fa-times"></i>
              </button>
            </a>
          </li>
        `;
      }).filter(item => item !== ''); // Filtrer les éléments vides
      
      if (items.length === 0) {
        favoritesList.innerHTML = '<li><p class="no-favorites">Aucun favori valide</p></li>';
        return;
      }
      
      favoritesList.innerHTML = items.join('');
      
      // Ajouter des écouteurs d'événements aux boutons de suppression dans la liste des favoris
      const removeButtons = favoritesList.querySelectorAll('.remove-favorite');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const url = this.getAttribute('data-url');
          
          // Retirer des favoris
          let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
          const index = favorites.indexOf(url);
          if (index !== -1) {
            favorites.splice(index, 1);
          }
          
          // Enregistrer les favoris mis à jour
          localStorage.setItem('favorites', JSON.stringify(favorites));
          
          // Mettre à jour l'affichage de la liste des favoris
          updateFavoritesList(favorites);
          
          // Mettre à jour l'état du bouton correspondant dans le menu principal
          const mainButton = document.querySelector(`.favorite-btn[data-url="${url}"]:not(.remove-favorite)`);
          if (mainButton) {
            mainButton.classList.remove('active');
            mainButton.innerHTML = '<i class="far fa-star"></i>';
            mainButton.setAttribute('title', 'Ajouter aux favoris');
          }
        });
      });
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