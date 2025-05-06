/**
 * Script pour gérer l'affichage de la version dans le footer
 * Ce script sera inclus dans toutes les pages pour assurer l'uniformité
 * du versionnage à travers l'application
 */

document.addEventListener('DOMContentLoaded', function() {
  // Récupérer la version depuis le serveur
  fetch('/api/system/version')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Mettre à jour tous les éléments avec la classe version-number
        const versionElements = document.querySelectorAll('.version-number');
        versionElements.forEach(el => {
          el.textContent = `v${data.data.version}`;
        });
        
        // Mettre à jour l'élément de version dans le footer
        const footerElement = document.querySelector('.footer-version');
        if (footerElement) {
          footerElement.innerHTML = `<span class="version-label">Version:</span> <span class="version-text">${data.data.version}</span>`;
        }
      }
    })
    .catch(error => {
      console.warn('Erreur lors de la récupération de la version:', error);
      
      // En cas d'erreur, utiliser une version par défaut
      const versionElements = document.querySelectorAll('.version-number');
      versionElements.forEach(el => {
        el.textContent = 'v1.0.0';
      });
    });
    
  // Créer ou mettre à jour l'élément de version dans le footer si nécessaire
  const footerTextElements = document.querySelectorAll('.footer-text');
  footerTextElements.forEach(element => {
    if (!element.querySelector('.footer-version')) {
      // Créer l'élément de version s'il n'existe pas
      const versionElement = document.createElement('div');
      versionElement.className = 'footer-version';
      versionElement.innerHTML = '<span class="version-label">Version:</span> <span class="version-text">Chargement...</span>';
      element.appendChild(versionElement);
    }
  });
});