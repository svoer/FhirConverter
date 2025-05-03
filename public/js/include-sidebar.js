// Script pour inclure le menu latéral dans toutes les pages
document.addEventListener('DOMContentLoaded', function() {
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
      
      // Maintenant que le menu est ajouté, initialiser son comportement
      // en déclenchant l'événement DOMContentLoaded pour sidebar-menu.js
      setTimeout(() => {
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
      }, 100);
    })
    .catch(error => {
      console.error('Erreur lors du chargement du menu latéral:', error);
    });
});