/**
 * Script d'aide pour l'utilisateur de la documentation Swagger
 * Ajoute automatiquement le token JWT pour les administrateurs et récupère une clé API
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si nous sommes sur la page Swagger
  if (window.location.pathname.includes('/api-docs')) {
    // Récupérer le token JWT du localStorage
    const token = localStorage.getItem('token');
    
    if (token) {
      // Fonction pour créer une boîte de message
      const createMessageBox = (message, isSuccess = true) => {
        const statusDiv = document.createElement('div');
        statusDiv.style.backgroundColor = isSuccess ? '#e8f5e9' : '#ffebee';
        statusDiv.style.color = isSuccess ? '#2e7d32' : '#c62828';
        statusDiv.style.padding = '10px';
        statusDiv.style.margin = '10px 0';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.innerHTML = message;
        
        // Insérer le message sur la page
        const infoContainer = document.querySelector('.swagger-ui .information-container');
        if (infoContainer) {
          // Éviter les doublons
          const existingMessages = infoContainer.querySelectorAll('div[data-type="message-box"]');
          existingMessages.forEach(el => el.remove());
          
          statusDiv.setAttribute('data-type', 'message-box');
          infoContainer.appendChild(statusDiv);
        }
      };
      
      // Fonction pour récupérer la clé API de développement
      const fetchDevApiKey = async () => {
        try {
          const response = await fetch('/api/dev/all-in-one', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.success && data.data.api_key) {
            // Sauvegarder la clé API pour une utilisation future
            localStorage.setItem('api_key', data.data.api_key);
            return data.data.api_key;
          } else {
            throw new Error('Clé API non trouvée dans la réponse');
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la clé API:', error);
          return null;
        }
      };
      
      // Ajouter un bouton "Obtenir et utiliser la clé API"
      const addApiKeyButton = () => {
        // Vérifier si le bouton existe déjà
        if (document.getElementById('get-api-key-btn')) {
          return;
        }
        
        const topbarContainer = document.querySelector('.swagger-ui .topbar .wrapper');
        if (topbarContainer) {
          const apiKeyBtn = document.createElement('button');
          apiKeyBtn.id = 'get-api-key-btn';
          apiKeyBtn.className = 'btn authorize';
          apiKeyBtn.style.backgroundColor = '#00579b';
          apiKeyBtn.style.color = 'white';
          apiKeyBtn.style.border = 'none';
          apiKeyBtn.style.borderRadius = '4px';
          apiKeyBtn.style.padding = '5px 10px';
          apiKeyBtn.style.marginLeft = '10px';
          apiKeyBtn.style.cursor = 'pointer';
          apiKeyBtn.innerHTML = '🔑 Obtenir et utiliser la clé API';
          
          apiKeyBtn.addEventListener('click', async () => {
            apiKeyBtn.disabled = true;
            apiKeyBtn.innerHTML = '⏳ Récupération de la clé API...';
            
            // Récupérer la clé API
            const apiKey = await fetchDevApiKey();
            
            if (apiKey) {
              // Ouvrir automatiquement le dialogue d'autorisation
              const authorizeButton = document.querySelector('.swagger-ui .auth-wrapper .authorize');
              if (authorizeButton) {
                authorizeButton.click();
                
                // Attendre que la boîte de dialogue s'ouvre
                setTimeout(() => {
                  // Remplir automatiquement le JWT et la clé API
                  const authInputs = document.querySelectorAll('.swagger-ui .auth-container input[type="text"]');
                  
                  authInputs.forEach(input => {
                    if (input.parentElement.textContent.includes('ApiKeyAuth')) {
                      input.value = apiKey;
                    }
                    if (input.parentElement.textContent.includes('BearerAuth')) {
                      input.value = `Bearer ${token}`;
                    }
                  });
                  
                  // Cliquer sur le bouton Authorize
                  const authorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .authorize');
                  if (authorizeBtn) {
                    authorizeBtn.click();
                    
                    // Afficher un message de succès
                    createMessageBox('✅ Authentification complète: JWT + Clé API configurés. <br>Vous pouvez maintenant utiliser les API sans restrictions.');
                    
                    // Mettre à jour le bouton
                    apiKeyBtn.innerHTML = '✅ Clé API active';
                    apiKeyBtn.style.backgroundColor = '#2e7d32';
                  }
                }, 500);
              }
            } else {
              // Afficher un message d'erreur
              createMessageBox('❌ Erreur lors de la récupération de la clé API. Vérifiez que vous êtes bien connecté en tant qu\'administrateur.', false);
              
              // Réinitialiser le bouton
              apiKeyBtn.disabled = false;
              apiKeyBtn.innerHTML = '🔄 Réessayer';
            }
          });
          
          topbarContainer.appendChild(apiKeyBtn);
        }
      };
      
      // Fonction principale qui attend que l'interface Swagger soit chargée
      const waitForSwaggerUI = setInterval(() => {
        const swaggerLoaded = document.querySelector('.swagger-ui .auth-wrapper');
        
        if (swaggerLoaded) {
          // Ajouter le bouton pour obtenir la clé API
          addApiKeyButton();
          
          // Afficher un message explicatif
          createMessageBox('Pour utiliser les API en tant qu\'administrateur, cliquez sur le bouton "Obtenir et utiliser la clé API" ci-dessus.');
          
          // Arrêter l'intervalle
          clearInterval(waitForSwaggerUI);
        }
      }, 1000);
      
      // Définir un timeout pour arrêter l'intervalle après 10 secondes
      setTimeout(() => {
        clearInterval(waitForSwaggerUI);
      }, 10000);
    }
  }
});