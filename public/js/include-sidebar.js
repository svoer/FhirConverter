// Script pour inclure le menu latéral dans toutes les pages
document.addEventListener('DOMContentLoaded', function() {
  // Ne pas exécuter pour la page de login
  if (window.location.pathname === '/login.html' || window.location.pathname === '/index.html') {
    return;
  }
  
  // Variable pour éviter les boucles infinies
  if (window.sidebarLoaded) return;
  window.sidebarLoaded = true;
  
  // Récupérer l'élément où insérer le sidebar (inséré au début du body)
  const targetElement = document.body;
  
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
      // On le fait à l'envers pour conserver l'ordre
      const nodes = Array.from(tempContainer.childNodes);
      for (let i = nodes.length - 1; i >= 0; i--) {
        targetElement.insertBefore(nodes[i], targetElement.firstChild);
      }
      
      // Initialiser le menu latéral
      if (typeof window.initSidebar === 'function') {
        setTimeout(() => {
          window.initSidebar();
          console.log('Menu latéral initialisé avec succès');
        }, 100);
      } else {
        console.warn('Fonction initSidebar non trouvée, utilisation du fallback');
        
        // Fonction simplifiée d'initialisation du menu (fallback)
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const favoriteButtons = document.querySelectorAll('.favorite-btn');

        if (menuToggle && sidebar) {
          menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            if (mainContent) mainContent.classList.toggle('expanded');
          });
        }
        
        // Initialiser les boutons favoris
        favoriteButtons.forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
          });
        });
        
        // Marquer la page active dans le menu
        const currentPath = window.location.pathname;
        const menuLinks = document.querySelectorAll('.nav-menu a');
        menuLinks.forEach(link => {
          if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
          }
        });
      }
    })
    .catch(error => {
      console.error('Erreur lors du chargement du menu latéral:', error);
    });
});