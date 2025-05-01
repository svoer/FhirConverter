/**
 * Script pour désactiver complètement les animations dans Swagger UI
 * Cette approche modifie directement les prototypes d'animation CSS pour Swagger
 */
(function() {
  // Fonction exécutée dès le chargement
  function disableSwaggerAnimations() {
    // Liste des éléments qui causent des clignotements
    const selectors = [
      '.swagger-ui .dialog-ux',
      '.swagger-ui .dialog-ux .backdrop-container',
      '.swagger-ui .dialog-ux .modal-ux',
      '.swagger-ui .dialog-ux .modal-ux-inner',
      '.swagger-ui .auth-container',
      '.swagger-ui .auth-btn-wrapper',
      '.swagger-ui .opblock-body pre.microlight',
      '.swagger-ui .opblock-summary',
      '.swagger-ui .model-box',
      '.swagger-ui section h4'
    ];
    
    // Créer un style qui désactive toutes les animations pour ces éléments
    let styleContent = '';
    selectors.forEach(selector => {
      styleContent += `
        ${selector} {
          animation: none !important;
          transition: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      `;
    });
    
    // Ajouter également une règle pour tous les éléments à l'intérieur des dialogs
    styleContent += `
      .swagger-ui .dialog-ux * {
        animation: none !important;
        transition: none !important;
      }
    `;
    
    // Créer et ajouter le style
    const style = document.createElement('style');
    style.textContent = styleContent;
    document.head.appendChild(style);
    
    // Fonction pour traiter les boîtes de dialogue qui apparaissent
    function handleDialogAppearance() {
      const dialog = document.querySelector('.swagger-ui .dialog-ux');
      if (dialog) {
        // Force une opacité stable sur le modal et son contenu
        const backdrop = dialog.querySelector('.backdrop-container');
        const modal = dialog.querySelector('.modal-ux');
        const inner = modal ? modal.querySelector('.modal-ux-inner') : null;
        
        if (backdrop) backdrop.style.cssText = 'animation: none !important; transition: none !important; opacity: 0.8 !important;';
        if (modal) modal.style.cssText = 'animation: none !important; transition: none !important; opacity: 1 !important;';
        if (inner) inner.style.cssText = 'animation: none !important; transition: none !important; transform: none !important;';
        
        // Observer les changements dans le dialog pour appliquer les styles à tout nouvel élément
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
              for (let i = 0; i < mutation.addedNodes.length; i++) {
                const node = mutation.addedNodes[i];
                if (node.nodeType === 1) { // Element node
                  node.style.animation = 'none';
                  node.style.transition = 'none';
                  
                  // Appliquer aussi aux enfants
                  const children = node.querySelectorAll('*');
                  children.forEach(child => {
                    child.style.animation = 'none';
                    child.style.transition = 'none';
                  });
                }
              }
            }
          });
        });
        
        observer.observe(dialog, { childList: true, subtree: true, attributes: true });
      }
    }
    
    // Observer le body pour détecter l'apparition de modals
    const bodyObserver = new MutationObserver(function(mutations) {
      handleDialogAppearance();
    });
    
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    
    // Exécuter immédiatement au cas où un dialog serait déjà présent
    handleDialogAppearance();
    
    // Créer une fonction qui sera appelée régulièrement pour s'assurer que les styles sont appliqués
    const interval = setInterval(function() {
      handleDialogAppearance();
    }, 100);
    
    // Arrêter l'intervalle après 5 secondes
    setTimeout(function() {
      clearInterval(interval);
      console.log('[Swagger] Animations désactivées avec succès');
    }, 5000);
  }
  
  // S'assurer que le script s'exécute après le chargement complet de la page
  if (document.readyState === 'complete') {
    disableSwaggerAnimations();
  } else {
    window.addEventListener('load', disableSwaggerAnimations);
  }
})();