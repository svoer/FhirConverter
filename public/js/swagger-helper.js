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
    // Fonction pour ajouter directement les boutons sans attendre
    const addButtonsDirectly = () => {
      console.log('Ajout direct des boutons dans Swagger UI');
      
      // Sélectionner la barre supérieure
      setTimeout(() => {
        const topbarContainer = document.querySelector('.swagger-ui .topbar .wrapper');
        if (topbarContainer) {
          console.log('Conteneur de topbar trouvé, ajout des boutons...');
          
          // Bouton Menu Principal
          const navBtn = document.createElement('a');
          navBtn.id = 'nav-menu-btn';
          navBtn.href = '/';
          navBtn.className = 'btn';
          navBtn.style.backgroundColor = '#e74c3c';
          navBtn.style.color = 'white';
          navBtn.style.border = 'none';
          navBtn.style.borderRadius = '4px';
          navBtn.style.padding = '5px 10px';
          navBtn.style.marginLeft = '10px';
          navBtn.style.cursor = 'pointer';
          navBtn.style.textDecoration = 'none';
          navBtn.innerHTML = '🏠 Menu Principal';
          topbarContainer.appendChild(navBtn);
          
          // Bouton Auth Test
          const quickAuthBtn = document.createElement('button');
          quickAuthBtn.id = 'quick-auth-btn';
          quickAuthBtn.className = 'btn';
          quickAuthBtn.style.backgroundColor = '#2ecc71';
          quickAuthBtn.style.color = 'white';
          quickAuthBtn.style.border = 'none';
          quickAuthBtn.style.borderRadius = '4px';
          quickAuthBtn.style.padding = '5px 10px';
          quickAuthBtn.style.marginLeft = '10px';
          quickAuthBtn.style.cursor = 'pointer';
          quickAuthBtn.innerHTML = '⚡ Autoriser avec clé de test (dev-key)';
          
          quickAuthBtn.addEventListener('click', () => {
            const testApiKey = 'dev-key';
            
            // Ouvrir le dialogue d'autorisation
            const authorizeBtn = document.querySelector('.swagger-ui .auth-wrapper .authorize');
            if (authorizeBtn) {
              authorizeBtn.click();
              
              // Attendre que le dialogue s'ouvre
              setTimeout(() => {
                // Remplir le champ avec la clé API de test
                const apiKeyInput = document.querySelector('.swagger-ui input[type="text"][data-param-name="api_key"]');
                if (apiKeyInput) {
                  apiKeyInput.value = testApiKey;
                  
                  // Simuler la saisie
                  const event = new Event('input', { bubbles: true });
                  apiKeyInput.dispatchEvent(event);
                  
                  // Cliquer sur Authorize
                  const dialogAuthorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
                  if (dialogAuthorizeBtn) {
                    dialogAuthorizeBtn.click();
                    
                    // Afficher une notification
                    const notif = document.createElement('div');
                    notif.style.position = 'fixed';
                    notif.style.top = '20px';
                    notif.style.right = '20px';
                    notif.style.backgroundColor = '#2ecc71';
                    notif.style.color = 'white';
                    notif.style.padding = '15px';
                    notif.style.borderRadius = '4px';
                    notif.style.zIndex = '9999';
                    notif.innerHTML = '✅ Autorisé avec la clé de test (dev-key)';
                    
                    document.body.appendChild(notif);
                    
                    // Supprimer la notification après 3 secondes
                    setTimeout(() => {
                      notif.remove();
                    }, 3000);
                  }
                }
              }, 300);
            }
          });
          
          topbarContainer.appendChild(quickAuthBtn);
          console.log('Boutons ajoutés avec succès');
        } else {
          console.log('Conteneur topbar non trouvé');
        }
      }, 2000); // Délai de 2 secondes pour s'assurer que Swagger UI est chargé
    };
    
    // Exécuter immédiatement
    addButtonsDirectly();
    
    // Ajouter un bouton pour générer une clé API temporaire même sans être connecté
    const addTempKeyButton = () => {
      // Vérifier si le bouton existe déjà
      if (document.getElementById('get-temp-api-key-btn')) {
        return;
      }
      
      const topbarContainer = document.querySelector('.swagger-ui .topbar .wrapper');
      if (topbarContainer) {
        // Ajouter un bouton pour accéder à la navigation principale
        const navBtn = document.createElement('a');
        navBtn.id = 'nav-menu-btn';
        navBtn.href = '/';
        navBtn.className = 'btn';
        navBtn.style.backgroundColor = '#e74c3c';
        navBtn.style.color = 'white';
        navBtn.style.border = 'none';
        navBtn.style.borderRadius = '4px';
        navBtn.style.padding = '5px 10px';
        navBtn.style.marginLeft = '10px';
        navBtn.style.cursor = 'pointer';
        navBtn.style.textDecoration = 'none';
        navBtn.innerHTML = '🏠 Menu Principal';
        topbarContainer.appendChild(navBtn);
        
        // Ajouter un bouton pour autoriser directement avec une clé de test
        const quickAuthBtn = document.createElement('button');
        quickAuthBtn.id = 'quick-auth-btn';
        quickAuthBtn.className = 'btn';
        quickAuthBtn.style.backgroundColor = '#2ecc71';
        quickAuthBtn.style.color = 'white';
        quickAuthBtn.style.border = 'none';
        quickAuthBtn.style.borderRadius = '4px';
        quickAuthBtn.style.padding = '5px 10px';
        quickAuthBtn.style.marginLeft = '10px';
        quickAuthBtn.style.cursor = 'pointer';
        quickAuthBtn.innerHTML = '⚡ Autoriser avec clé de test (dev-key)';
        
        quickAuthBtn.addEventListener('click', () => {
          // Clé de test fixe pour les tests rapides
          const testApiKey = 'dev-key';
          
          // Ouvrir le dialogue d'autorisation
          const authorizeBtn = document.querySelector('.swagger-ui .auth-wrapper .authorize');
          if (authorizeBtn) {
            authorizeBtn.click();
            
            // Attendre que le dialogue s'ouvre
            setTimeout(() => {
              // Remplir le champ avec la clé API de test
              const apiKeyInput = document.querySelector('.swagger-ui input[type="text"][data-param-name="api_key"]');
              if (apiKeyInput) {
                apiKeyInput.value = testApiKey;
                
                // Simuler la saisie
                const event = new Event('input', { bubbles: true });
                apiKeyInput.dispatchEvent(event);
                
                // Cliquer sur Authorize
                const dialogAuthorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
                if (dialogAuthorizeBtn) {
                  dialogAuthorizeBtn.click();
                  
                  // Afficher une notification
                  const notif = document.createElement('div');
                  notif.style.position = 'fixed';
                  notif.style.top = '20px';
                  notif.style.right = '20px';
                  notif.style.backgroundColor = '#2ecc71';
                  notif.style.color = 'white';
                  notif.style.padding = '15px';
                  notif.style.borderRadius = '4px';
                  notif.style.zIndex = '9999';
                  notif.innerHTML = '✅ Autorisé avec la clé de test (dev-key)';
                  
                  document.body.appendChild(notif);
                  
                  // Supprimer la notification après 3 secondes
                  setTimeout(() => {
                    notif.remove();
                  }, 3000);
                }
              }
            }, 300);
          }
        });
        
        topbarContainer.appendChild(quickAuthBtn);
        
        // Bouton de génération de clé API temporaire
        const tempKeyBtn = document.createElement('button');
        tempKeyBtn.id = 'get-temp-api-key-btn';
        tempKeyBtn.className = 'btn';
        tempKeyBtn.style.backgroundColor = '#f39c12';
        tempKeyBtn.style.color = 'white';
        tempKeyBtn.style.border = 'none';
        tempKeyBtn.style.borderRadius = '4px';
        tempKeyBtn.style.padding = '5px 10px';
        tempKeyBtn.style.marginLeft = '10px';
        tempKeyBtn.style.cursor = 'pointer';
        tempKeyBtn.innerHTML = '🔑 Générer une clé API temporaire';
        
        tempKeyBtn.addEventListener('click', async () => {
          tempKeyBtn.disabled = true;
          tempKeyBtn.innerHTML = '⏳ Génération de la clé API...';
          
          try {
            // Appeler l'API pour générer une clé temporaire
            const response = await fetch('/api/dev/generate-temp-key');
            
            if (!response.ok) {
              throw new Error(`Erreur HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data.apiKey) {
              // Créer une boîte de message pour afficher la clé
              const messageBox = document.createElement('div');
              messageBox.style.backgroundColor = '#e8f5e9';
              messageBox.style.color = '#2e7d32';
              messageBox.style.padding = '15px';
              messageBox.style.margin = '10px 0';
              messageBox.style.borderRadius = '4px';
              messageBox.style.fontWeight = 'bold';
              messageBox.style.position = 'relative';
              
              // Bouton de copie
              const copyBtn = document.createElement('button');
              copyBtn.style.position = 'absolute';
              copyBtn.style.right = '15px';
              copyBtn.style.top = '15px';
              copyBtn.style.padding = '5px 10px';
              copyBtn.style.backgroundColor = '#2e7d32';
              copyBtn.style.color = 'white';
              copyBtn.style.border = 'none';
              copyBtn.style.borderRadius = '4px';
              copyBtn.style.cursor = 'pointer';
              copyBtn.innerHTML = 'Copier';
              
              copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(data.data.apiKey)
                  .then(() => {
                    copyBtn.innerHTML = '✓ Copié';
                    setTimeout(() => {
                      copyBtn.innerHTML = 'Copier';
                    }, 2000);
                  })
                  .catch(err => {
                    console.error('Erreur lors de la copie:', err);
                    copyBtn.innerHTML = '✗ Erreur';
                  });
              });
              
              messageBox.innerHTML = `
                <h3>✅ Clé API temporaire générée</h3>
                <p>Cette clé est valide pendant 24 heures. Utilisez-la pour tester les API.</p>
                <p style="margin-top: 10px; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${data.data.apiKey}</p>
                <p style="margin-top: 10px; color: #e74c3c;"><strong>Important:</strong> Cette clé ne sera affichée qu'une seule fois. Veuillez la copier maintenant.</p>
                <p style="margin-top: 5px; font-size: 0.9em;">Expire le: ${new Date(data.data.expiresAt).toLocaleString()}</p>
              `;
              
              messageBox.appendChild(copyBtn);
              
              // Insérer la boîte sur la page
              const infoContainer = document.querySelector('.swagger-ui .information-container');
              if (infoContainer) {
                // Éviter les doublons
                const existingMessages = infoContainer.querySelectorAll('div[data-type="temp-key-message"]');
                existingMessages.forEach(el => el.remove());
                
                messageBox.setAttribute('data-type', 'temp-key-message');
                infoContainer.appendChild(messageBox);
                
                // Ouvrir automatiquement le dialogue d'autorisation
                setTimeout(() => {
                  const authorizeButton = document.querySelector('.swagger-ui .auth-wrapper .authorize');
                  if (authorizeButton) {
                    authorizeButton.click();
                    
                    // Attendre que la boîte de dialogue s'ouvre
                    setTimeout(() => {
                      // Remplir automatiquement la clé API
                      const authInputs = document.querySelectorAll('.swagger-ui .auth-container input[type="text"]');
                      
                      authInputs.forEach(input => {
                        if (input.parentElement.textContent.includes('ApiKeyAuth')) {
                          input.value = data.data.apiKey;
                        }
                      });
                    }, 500);
                  }
                }, 1000);
              }
              
              // Mettre à jour le bouton
              tempKeyBtn.innerHTML = '✅ Clé API générée';
              tempKeyBtn.style.backgroundColor = '#2e7d32';
              
              // Réactiver le bouton après un certain temps
              setTimeout(() => {
                tempKeyBtn.disabled = false;
                tempKeyBtn.innerHTML = '🔑 Générer une nouvelle clé API';
              }, 5000);
            } else {
              throw new Error('Clé API non trouvée dans la réponse');
            }
          } catch (error) {
            console.error('Erreur lors de la génération de la clé API:', error);
            tempKeyBtn.disabled = false;
            tempKeyBtn.innerHTML = '🔄 Réessayer';
            tempKeyBtn.style.backgroundColor = '#e74c3c';
            
            // Afficher un message d'erreur
            const errorBox = document.createElement('div');
            errorBox.style.backgroundColor = '#ffebee';
            errorBox.style.color = '#c62828';
            errorBox.style.padding = '10px';
            errorBox.style.margin = '10px 0';
            errorBox.style.borderRadius = '4px';
            errorBox.style.fontWeight = 'bold';
            errorBox.innerHTML = `❌ Erreur lors de la génération de la clé API: ${error.message}`;
            
            const infoContainer = document.querySelector('.swagger-ui .information-container');
            if (infoContainer) {
              infoContainer.appendChild(errorBox);
            }
          }
        });
        
        topbarContainer.appendChild(tempKeyBtn);
      }
    };
    
    // Attendre que l'interface Swagger soit chargée pour ajouter le bouton temporaire
    const waitForSwaggerUITemp = setInterval(() => {
      const swaggerLoaded = document.querySelector('.swagger-ui .auth-wrapper');
      
      if (swaggerLoaded) {
        addTempKeyButton();
        clearInterval(waitForSwaggerUITemp);
      }
    }, 1000);
    
    // Définir un timeout pour arrêter l'intervalle après 10 secondes
    setTimeout(() => {
      clearInterval(waitForSwaggerUITemp);
    }, 10000);
    
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