/**
 * Script d'aide pour l'utilisateur de la documentation Swagger
 * Ajoute automatiquement le token JWT pour les administrateurs et récupère une clé API
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si nous sommes sur la page Swagger
  if (window.location.pathname.includes('/api-docs')) {
    // Ajouter des styles personnalisés pour améliorer l'apparence de Swagger UI
    const customStyles = document.createElement('style');
    customStyles.textContent = `
      body {
        padding-top: 0;
      }
      
      .swagger-ui .topbar {
        background: linear-gradient(135deg, #e74c3c, #ff5722);
      }
      
      .swagger-ui .topbar .download-url-wrapper .select-label {
        color: white !important;
      }
      
      .swagger-ui .btn.authorize {
        background: linear-gradient(to right, #e74c3c, #ff5722);
        color: white;
        border-color: transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }
      
      .swagger-ui .btn.authorize:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .swagger-ui .btn.authorize svg {
        fill: white;
      }
      
      .info-text-with-api-key {
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 12px 15px;
        margin: 15px 0;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        font-size: 14px;
      }
      
      /* Réduction du clignotement */
      .swagger-ui .dialog-ux {
        transition: opacity 0.4s ease;
      }
      
      .swagger-ui .opblock.opblock-get .opblock-summary {
        border-color: #61affe;
      }
      
      .swagger-ui section.models {
        margin-top: 20px;
      }
      
      /* Amélioration du modal d'authentification */
      .swagger-ui .auth-container {
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        border-radius: 8px;
        border: none;
      }
      
      .swagger-ui .auth-container h4 {
        font-size: 16px;
        margin-bottom: 10px;
      }
      
      .swagger-ui .auth-container input {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 8px 12px;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .auth-container input:focus {
        border-color: #ff5722;
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.1);
      }
      
      .swagger-ui .auth-btn-wrapper {
        display: flex;
        justify-content: flex-end;
        padding-top: 10px;
      }
      
      .swagger-ui .auth-btn-wrapper .btn {
        border-radius: 4px;
        padding: 8px 16px;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .auth-btn-wrapper .btn-done {
        background: linear-gradient(to right, #e74c3c, #ff5722);
        color: white;
        border: none;
      }
      
      .swagger-ui .auth-btn-wrapper .btn-done:hover {
        background: linear-gradient(to right, #d63031, #e84118);
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      
      /* Transition sur les endpoints */
      .swagger-ui .opblock {
        transition: all 0.3s ease;
        margin-bottom: 15px;
        border-radius: 6px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      }
      
      .swagger-ui .opblock:hover {
        box-shadow: 0 5px 15px rgba(0,0,0,0.08);
        transform: translateY(-2px);
      }
      
      /* Section de navigation */
      .swagger-ui .wrapper {
        padding: 0 30px;
      }
      
      /* Préventions des clignotements */
      .swagger-ui .loading-container {
        opacity: 0;
        transition: opacity 0.5s ease;
      }
      
      .swagger-ui .loading-container.loaded {
        opacity: 1;
      }
    `;
    document.head.appendChild(customStyles);
    
    // Ajouter une info-bulle pour expliquer comment utiliser les clés API
    setTimeout(() => {
      const infoSection = document.querySelector('.swagger-ui .information-container');
      if (infoSection) {
        const infoTip = document.createElement('div');
        infoTip.className = 'info-text-with-api-key';
        infoTip.innerHTML = `
          <p><strong>💡 Conseil :</strong> Pour tester les API, utilisez le bouton vert <strong>⚡ Autoriser</strong> ci-dessus et saisissez la clé de test : <code>dev-key</code> dans le champ apiKey.</p>
        `;
        infoSection.appendChild(infoTip);
      }
    }, 1000);
    
    // Fonction pour ajouter un bouton retour en haut
    const addNavigation = () => {
      // Vérifier si la navigation existe déjà
      if (document.querySelector('.fhirhub-back-btn')) {
        return;
      }
      
      // Créer le bouton de retour
      const backBtn = document.createElement('a');
      backBtn.className = 'fhirhub-back-btn';
      backBtn.href = '/dashboard.html';
      backBtn.style.backgroundColor = '#e74c3c';
      backBtn.style.background = 'linear-gradient(to right, #e74c3c, #f39c12)';
      backBtn.style.color = 'white';
      backBtn.style.padding = '8px 16px';
      backBtn.style.display = 'inline-flex';
      backBtn.style.alignItems = 'center';
      backBtn.style.position = 'fixed';
      backBtn.style.top = '10px';
      backBtn.style.left = '10px';
      backBtn.style.zIndex = '9999';
      backBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      backBtn.style.borderRadius = '4px';
      backBtn.style.fontWeight = 'bold';
      backBtn.style.fontSize = '14px';
      backBtn.style.textDecoration = 'none';
      
      // Icône de retour
      const backIcon = document.createElement('span');
      backIcon.innerHTML = '&larr; ';
      backIcon.style.marginRight = '5px';
      
      // Texte du bouton
      const backText = document.createTextNode('Retour');
      
      backBtn.appendChild(backIcon);
      backBtn.appendChild(backText);
      
      // Ajouter le bouton au début du body
      document.body.insertBefore(backBtn, document.body.firstChild);
      
      // Ajuster la position de la barre Swagger pour éviter qu'elle ne soit cachée
      const swaggerTopbar = document.querySelector('.swagger-ui .topbar');
      if (swaggerTopbar) {
        swaggerTopbar.style.paddingLeft = '100px';
      }
    };
    
    // Fonction pour ajouter directement les boutons sans attendre
    const addButtonsDirectly = () => {
      console.log('Ajout direct des boutons dans Swagger UI');
      
      // Ajouter uniquement la barre de navigation
      addNavigation();
      
      console.log('Barre d\'actions ajoutée avec succès');
    };
    
    // Exécuter immédiatement
    addButtonsDirectly();
    
    // Ajoutons d'abord des styles spécifiques pour complètement désactiver les animations de Swagger
    const noFlickerStyles = document.createElement('style');
    noFlickerStyles.textContent = `
      /* Désactiver toutes les animations et transitions de Swagger UI qui causent le clignotement */
      .swagger-ui * {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
      
      /* Masquer complètement le fond modal pendant l'animation */
      .swagger-ui .dialog-ux .backdrop-container {
        transition: none !important;
        animation: none !important;
      }
      
      /* Priorité maximale pour le conteneur modal */
      .swagger-ui .dialog-ux .modal-ux {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
      }
      
      /* Le contenu du modal ne doit pas avoir d'animation */
      .swagger-ui .dialog-ux .modal-ux-inner {
        transform: none !important;
        transition: none !important;
        animation: none !important;
      }
      
      /* Corrections spécifiques pour les composants auth */
      .swagger-ui .auth-container {
        opacity: 1 !important;
        animation: none !important;
        transition: none !important;
      }
      
      /* Appliquer des styles propres après le chargement complet */
      .swagger-ui .opblock-body pre.microlight {
        transition: none !important;
      }
      
      /* Fenêtre modale doit rester stable */
      .swagger-ui .dialog-ux .modal-ux-content {
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(noFlickerStyles);
    
    // Réduire le clignotement de l'autorisation par une approche plus agressive
    const preventFlickerScript = document.createElement('script');
    preventFlickerScript.textContent = `
      (function() {
        // Remplacer complètement les animations Swagger
        const overrideSwaggerAnims = setInterval(() => {
          // Cibler les éléments qui causent des clignotements
          const backdrop = document.querySelector('.swagger-ui .dialog-ux .backdrop-container');
          const modal = document.querySelector('.swagger-ui .dialog-ux .modal-ux');
          const modalInner = document.querySelector('.swagger-ui .dialog-ux .modal-ux-inner');
          const authContainer = document.querySelector('.swagger-ui .auth-container');
          
          // Appliquer des styles directs à ces éléments
          if (backdrop) {
            backdrop.style.cssText = "animation: none !important; transition: none !important; opacity: 1 !important;";
          }
          
          if (modal) {
            modal.style.cssText = "animation: none !important; transition: none !important; opacity: 1 !important;";
          }
          
          if (modalInner) {
            modalInner.style.cssText = "animation: none !important; transition: none !important; transform: none !important;";
          }
          
          if (authContainer) {
            authContainer.style.cssText = "animation: none !important; transition: none !important; opacity: 1 !important;";
          }
          
          // Observer toute modification du DOM pour agir immédiatement
          const targetNode = document.body;
          const config = { childList: true, subtree: true, attributes: true };
          
          const callback = function(mutationsList, observer) {
            for (const mutation of mutationsList) {
              // Cibler spécifiquement les modifications des dialogs
              if (document.querySelector('.swagger-ui .dialog-ux')) {
                // Désactiver toute animation
                const dialogElements = document.querySelectorAll('.swagger-ui .dialog-ux *');
                dialogElements.forEach(el => {
                  el.style.animation = 'none';
                  el.style.transition = 'none';
                  
                  // Forcer l'opacité pour les conteneurs
                  if (el.classList.contains('modal-ux') || 
                      el.classList.contains('backdrop-container') ||
                      el.classList.contains('auth-container') ||
                      el.classList.contains('modal-ux-inner')) {
                    el.style.opacity = '1';
                    el.style.transform = 'none';
                  }
                });
              }
            }
          };
          
          const observer = new MutationObserver(callback);
          observer.observe(targetNode, config);
          
          // Nettoyer après 5 secondes (quand tout est chargé)
          setTimeout(() => {
            clearInterval(overrideSwaggerAnims);
          }, 5000);
        }, 100);
      })();
    `;
    document.head.appendChild(preventFlickerScript);
    
    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem('token');
    
    // Attendre que Swagger UI soit complètement chargé pour traiter les tokens
    setTimeout(() => {
      // Si un token est trouvé, l'ajouter automatiquement
      if (token) {
        // Ouvrir le dialogue d'autorisation
        const authorizeBtn = document.querySelector('.swagger-ui .auth-wrapper .authorize');
        if (authorizeBtn) {
          authorizeBtn.click();
          
          // Attendre que le dialogue s'ouvre
          setTimeout(() => {
            // Trouver les champs pour chaque type d'auth
            const bearerInput = document.querySelector('.swagger-ui input[data-param-name="bearer"]');
            
            if (bearerInput) {
              bearerInput.value = token;
              // Simuler la saisie
              const event = new Event('input', { bubbles: true });
              bearerInput.dispatchEvent(event);
            }
            
            // Cliquer sur Authorize
            const dialogAuthorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
            if (dialogAuthorizeBtn) {
              dialogAuthorizeBtn.click();
              console.log('Token JWT automatiquement appliqué');
            }
          }, 300);
        }
      }
    }, 2000);
  }
});