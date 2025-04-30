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
        background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
      }
      
      .swagger-ui .topbar .download-url-wrapper .select-label {
        color: white !important;
      }
      
      .swagger-ui .btn.authorize {
        background-color: #4caf50;
        color: white;
        border-color: #43a047;
      }
      
      .swagger-ui .btn.authorize svg {
        fill: white;
      }
      
      .info-text-with-api-key {
        background-color: #e8f5e9;
        border-left: 4px solid #4caf50;
        padding: 10px 15px;
        margin: 10px 0;
        border-radius: 4px;
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
          <p><strong>💡 Conseil :</strong> Pour tester les API, utilisez le bouton vert <strong>⚡ Autoriser avec clé de test</strong> ci-dessus. 
          La clé <code>dev-key</code> est automatiquement appliquée.</p>
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