/**
 * Script d'aide pour l'utilisateur de la documentation Swagger
 * Ajoute automatiquement le token JWT pour les administrateurs
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si nous sommes sur la page Swagger
  if (window.location.pathname.includes('/api-docs')) {
    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      // Fonction pour attendre que l'interface Swagger soit chargée
      const waitForSwaggerUI = setInterval(() => {
        const authorizeButton = document.querySelector('.swagger-ui .auth-wrapper .authorize');
        const bearerInput = document.querySelector('.swagger-ui .auth-container input[type="text"]');
        
        if (authorizeButton && !bearerInput) {
          // Cliquer sur le bouton Authorize pour ouvrir la boîte de dialogue
          authorizeButton.click();
          
          // Attendre que la boîte de dialogue s'ouvre
          setTimeout(() => {
            // Trouver l'entrée pour le Bearer token
            const bearerInputs = document.querySelectorAll('.swagger-ui .auth-container input[type="text"]');
            
            // Remplir automatiquement le token JWT
            bearerInputs.forEach(input => {
              if (input.placeholder === 'JWT' || input.parentElement.textContent.includes('Bearer')) {
                input.value = `Bearer ${token}`;
              }
            });
            
            // Cliquer sur le bouton Authorize
            const authorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .authorize');
            if (authorizeBtn) {
              authorizeBtn.click();
              
              // Ajouter un message de statut
              const statusDiv = document.createElement('div');
              statusDiv.style.backgroundColor = '#e8f5e9';
              statusDiv.style.color = '#2e7d32';
              statusDiv.style.padding = '10px';
              statusDiv.style.margin = '10px 0';
              statusDiv.style.borderRadius = '4px';
              statusDiv.style.fontWeight = 'bold';
              statusDiv.innerHTML = '✅ Authentification administrative activée. Utilisez les API sans restrictions.';
              
              // Insérer le message sur la page
              const infoContainer = document.querySelector('.swagger-ui .information-container');
              if (infoContainer) {
                infoContainer.appendChild(statusDiv);
              }
              
              // Arrêter l'intervalle
              clearInterval(waitForSwaggerUI);
            }
          }, 500);
        }
      }, 1000);
      
      // Définir un timeout pour arrêter l'intervalle après 10 secondes
      setTimeout(() => {
        clearInterval(waitForSwaggerUI);
      }, 10000);
    }
  }
});