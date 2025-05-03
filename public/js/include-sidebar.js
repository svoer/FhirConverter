// Script pour inclure le menu latéral dans toutes les pages
document.addEventListener('DOMContentLoaded', function() {
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
      
      // Initialiser directement le menu latéral sans déclencher un nouvel événement DOMContentLoaded
      if (typeof initSidebar === 'function') {
        initSidebar();
      } else {
        // Fonction simplifiée d'initialisation du menu
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
      }
    })
    .catch(error => {
      console.error('Erreur lors du chargement du menu latéral:', error);
    });
});