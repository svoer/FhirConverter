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
    // Fonction pour ajouter une barre de navigation en haut
    const addNavigation = () => {
      // Vérifier si la navigation existe déjà
      if (document.querySelector('.fhirhub-nav')) {
        return;
      }
      
      // Créer la barre de navigation
      const navBar = document.createElement('div');
      navBar.className = 'fhirhub-nav';
      navBar.style.backgroundColor = '#e74c3c';
      navBar.style.background = 'linear-gradient(to right, #e74c3c, #f39c12)';
      navBar.style.color = 'white';
      navBar.style.padding = '10px 20px';
      navBar.style.display = 'flex';
      navBar.style.alignItems = 'center';
      navBar.style.justifyContent = 'space-between';
      navBar.style.width = '100%';
      navBar.style.position = 'fixed';
      navBar.style.top = '0';
      navBar.style.left = '0';
      navBar.style.zIndex = '9999';
      navBar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      
      // Logo et titre
      const logoDiv = document.createElement('div');
      logoDiv.style.display = 'flex';
      logoDiv.style.alignItems = 'center';
      
      // Icône flamme
      const flameIcon = document.createElement('img');
      flameIcon.src = '/img/flame-icon-white.svg';
      flameIcon.alt = 'FHIRHub';
      flameIcon.style.height = '24px';
      flameIcon.style.marginRight = '10px';
      
      // Titre
      const title = document.createElement('h1');
      title.style.margin = '0';
      title.style.fontSize = '18px';
      title.style.fontWeight = 'bold';
      title.textContent = 'FHIRHub';
      
      logoDiv.appendChild(flameIcon);
      logoDiv.appendChild(title);
      
      // Créer un menu de navigation similaire à celui du dashboard
      const navMenu = document.createElement('ul');
      navMenu.style.display = 'flex';
      navMenu.style.gap = '20px';
      navMenu.style.listStyle = 'none';
      navMenu.style.margin = '0';
      navMenu.style.padding = '0';
      
      const createNavItem = (text, href, icon) => {
        const li = document.createElement('li');
        
        const link = document.createElement('a');
        link.href = href;
        link.style.color = 'white';
        link.style.textDecoration = 'none';
        link.style.fontWeight = '500';
        link.style.display = 'flex';
        link.style.alignItems = 'center';
        
        // Ajouter l'icône (utilisation des emojis comme substitut aux icônes Font Awesome)
        const iconSpan = document.createElement('span');
        iconSpan.innerHTML = icon + ' ';
        iconSpan.style.marginRight = '5px';
        
        link.appendChild(iconSpan);
        link.appendChild(document.createTextNode(text));
        li.appendChild(link);
        return li;
      };
      
      const dashboardLink = createNavItem('Tableau de bord', '/dashboard.html', '📊');
      const convertLink = createNavItem('Convertir', '/convert.html', '🔄');
      const appsLink = createNavItem('Applications', '/applications.html', '⚙️');
      const apiKeysLink = createNavItem('Clés API', '/api-keys.html', '🔑');
      const docsLink = createNavItem('Documentation', '/documentation.html', '📚');
      const apiDocsLink = createNavItem('API Docs', '/api-docs', '📋');
      
      navMenu.appendChild(dashboardLink);
      navMenu.appendChild(convertLink);
      navMenu.appendChild(appsLink);
      navMenu.appendChild(apiKeysLink);
      navMenu.appendChild(docsLink);
      
      // Créer un conteneur pour le menu
      const navLinks = document.createElement('div');
      navLinks.appendChild(navMenu);
      
      navBar.appendChild(logoDiv);
      navBar.appendChild(navLinks);
      
      // Ajouter la navigation au début du body
      document.body.insertBefore(navBar, document.body.firstChild);
      
      // Ajouter un espace pour éviter que le contenu ne soit caché sous la barre de navigation
      const spacer = document.createElement('div');
      spacer.style.height = '50px';
      document.body.insertBefore(spacer, navBar.nextSibling);
      
      // Ajuster la position de la barre Swagger pour éviter qu'elle ne soit cachée
      const swaggerTopbar = document.querySelector('.swagger-ui .topbar');
      if (swaggerTopbar) {
        swaggerTopbar.style.top = '50px';
        swaggerTopbar.style.position = 'sticky';
      }
    };
    
    // Fonction pour ajouter directement les boutons sans attendre
    const addButtonsDirectly = () => {
      console.log('Ajout direct des boutons dans Swagger UI');
      
      // Ajouter d'abord la barre de navigation
      addNavigation();
      
      // Créer une barre d'actions personnalisée pour les clés API
      const createActionBar = () => {
        // Vérifier si la barre existe déjà
        if (document.getElementById('fhirhub-action-bar')) {
          return;
        }
        
        // Créer la barre d'action avec un style attrayant
        const actionBar = document.createElement('div');
        actionBar.id = 'fhirhub-action-bar';
        actionBar.style.backgroundColor = '#fff';
        actionBar.style.padding = '15px 20px';
        actionBar.style.margin = '70px 0 20px 0';
        actionBar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        actionBar.style.borderRadius = '8px';
        actionBar.style.display = 'flex';
        actionBar.style.flexDirection = 'column';
        actionBar.style.alignItems = 'stretch';
        actionBar.style.width = 'calc(100% - 40px)';
        actionBar.style.maxWidth = '1200px';
        actionBar.style.margin = '70px auto 20px auto';
        actionBar.style.zIndex = '100';
        
        // Titre de la section
        const actionTitle = document.createElement('h2');
        actionTitle.style.margin = '0 0 15px 0';
        actionTitle.style.fontSize = '18px';
        actionTitle.style.fontWeight = 'bold';
        actionTitle.style.color = '#333';
        actionTitle.style.display = 'flex';
        actionTitle.style.alignItems = 'center';
        actionTitle.innerHTML = '<span style="font-size: 24px; margin-right: 8px;">🔐</span> Authentification FHIRHub API';
        
        // Description
        const actionDesc = document.createElement('p');
        actionDesc.style.margin = '0 0 15px 0';
        actionDesc.style.color = '#666';
        actionDesc.innerHTML = 'Utilisez les boutons ci-dessous pour tester les API facilement. La clé <code>dev-key</code> vous donne accès à tous les endpoints pour vos tests.';
        
        // Conteneur de boutons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '15px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.marginTop = '10px';
        
        // Bouton Auth Test avec Dev Key
        const quickAuthBtn = document.createElement('button');
        quickAuthBtn.id = 'quick-auth-btn';
        quickAuthBtn.className = 'btn';
        quickAuthBtn.style.backgroundColor = '#2ecc71';
        quickAuthBtn.style.color = 'white';
        quickAuthBtn.style.border = 'none';
        quickAuthBtn.style.borderRadius = '4px';
        quickAuthBtn.style.padding = '10px 15px';
        quickAuthBtn.style.cursor = 'pointer';
        quickAuthBtn.style.fontWeight = 'bold';
        quickAuthBtn.style.display = 'flex';
        quickAuthBtn.style.alignItems = 'center';
        quickAuthBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        quickAuthBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⚡</span> Autoriser avec dev-key';
        
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
                  notif.style.top = '80px';
                  notif.style.right = '20px';
                  notif.style.backgroundColor = '#2ecc71';
                  notif.style.color = 'white';
                  notif.style.padding = '15px';
                  notif.style.borderRadius = '4px';
                  notif.style.zIndex = '9999';
                  notif.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)';
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
        
        // Bouton de génération de clé API temporaire
        const tempKeyBtn = document.createElement('button');
        tempKeyBtn.id = 'get-temp-api-key-btn';
        tempKeyBtn.className = 'btn';
        tempKeyBtn.style.backgroundColor = '#f39c12';
        tempKeyBtn.style.color = 'white';
        tempKeyBtn.style.border = 'none';
        tempKeyBtn.style.borderRadius = '4px';
        tempKeyBtn.style.padding = '10px 15px';
        tempKeyBtn.style.cursor = 'pointer';
        tempKeyBtn.style.fontWeight = 'bold';
        tempKeyBtn.style.display = 'flex';
        tempKeyBtn.style.alignItems = 'center';
        tempKeyBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        tempKeyBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔑</span> Générer une clé API temporaire';
        
        tempKeyBtn.addEventListener('click', async () => {
          tempKeyBtn.disabled = true;
          tempKeyBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⏳</span> Génération de la clé API...';
          
          try {
            // Simuler la génération d'une clé API temporaire
            const tempApiKey = 'temp-' + Math.random().toString(36).substring(2, 15);
            
            // Créer une boîte de message pour afficher la clé
            const messageBox = document.createElement('div');
            messageBox.setAttribute('data-type', 'temp-key-message');
            messageBox.style.backgroundColor = '#e8f5e9';
            messageBox.style.color = '#2e7d32';
            messageBox.style.padding = '15px';
            messageBox.style.margin = '15px 0';
            messageBox.style.borderRadius = '8px';
            messageBox.style.fontWeight = 'bold';
            messageBox.style.position = 'relative';
            messageBox.style.zIndex = '1000';
            messageBox.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            
            // Bouton de copie
            const copyBtn = document.createElement('button');
            copyBtn.style.position = 'absolute';
            copyBtn.style.right = '15px';
            copyBtn.style.top = '15px';
            copyBtn.style.padding = '8px 12px';
            copyBtn.style.backgroundColor = '#2e7d32';
            copyBtn.style.color = 'white';
            copyBtn.style.border = 'none';
            copyBtn.style.borderRadius = '4px';
            copyBtn.style.cursor = 'pointer';
            copyBtn.style.fontWeight = 'bold';
            copyBtn.innerHTML = '📋 Copier';
            
            copyBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(tempApiKey)
                .then(() => {
                  copyBtn.innerHTML = '✅ Copié!';
                  setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copier';
                  }, 2000);
                })
                .catch(err => {
                  console.error('Erreur lors de la copie:', err);
                });
            });
            
            // Bouton pour utiliser cette clé
            const useKeyBtn = document.createElement('button');
            useKeyBtn.style.marginTop = '15px';
            useKeyBtn.style.padding = '10px 15px';
            useKeyBtn.style.backgroundColor = '#2196F3';
            useKeyBtn.style.color = 'white';
            useKeyBtn.style.border = 'none';
            useKeyBtn.style.borderRadius = '4px';
            useKeyBtn.style.cursor = 'pointer';
            useKeyBtn.style.fontWeight = 'bold';
            useKeyBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            useKeyBtn.innerHTML = '🔐 Utiliser cette clé';
            
            useKeyBtn.addEventListener('click', () => {
              // Ouvrir le dialogue d'autorisation
              const authorizeBtn = document.querySelector('.swagger-ui .auth-wrapper .authorize');
              if (authorizeBtn) {
                authorizeBtn.click();
                
                // Attendre que le dialogue s'ouvre
                setTimeout(() => {
                  // Remplir le champ avec la clé API temporaire
                  const apiKeyInput = document.querySelector('.swagger-ui input[type="text"][data-param-name="api_key"]');
                  if (apiKeyInput) {
                    apiKeyInput.value = tempApiKey;
                    
                    // Simuler la saisie
                    const event = new Event('input', { bubbles: true });
                    apiKeyInput.dispatchEvent(event);
                    
                    // Cliquer sur Authorize
                    const dialogAuthorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
                    if (dialogAuthorizeBtn) {
                      dialogAuthorizeBtn.click();
                    }
                  }
                }, 300);
              }
            });
            
            messageBox.innerHTML = `
              <h3 style="margin-top: 0;">✅ Clé API temporaire générée</h3>
              <p>Cette clé est valide pendant 24 heures pour tester les API.</p>
              <p style="margin-top: 10px; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; max-width: calc(100% - 100px);">${tempApiKey}</p>
              <p style="margin-top: 10px; color: #e74c3c;"><strong>Important:</strong> Cette clé est temporaire et pour démonstration uniquement.</p>
            `;
            
            messageBox.appendChild(copyBtn);
            messageBox.appendChild(useKeyBtn);
            
            // Supprimer les messages existants
            const existingMessages = document.querySelectorAll('[data-type="temp-key-message"]');
            existingMessages.forEach(el => el.remove());
            
            // Ajouter le message à la barre d'action
            actionBar.appendChild(messageBox);
            
            // Mettre à jour le bouton
            tempKeyBtn.disabled = false;
            tempKeyBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✅</span> Clé générée ! Générer une autre ?';
            
            // Réinitialiser le bouton après un certain temps
            setTimeout(() => {
              tempKeyBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔑</span> Générer une clé API temporaire';
            }, 5000);
            
          } catch (error) {
            console.error('Erreur lors de la génération de la clé API:', error);
            tempKeyBtn.disabled = false;
            tempKeyBtn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">🔄</span> Réessayer';
          }
        });
        
        // Ajouter les boutons au conteneur
        buttonContainer.appendChild(quickAuthBtn);
        buttonContainer.appendChild(tempKeyBtn);
        
        // Assembler tous les éléments
        actionBar.appendChild(actionTitle);
        actionBar.appendChild(actionDesc);
        actionBar.appendChild(buttonContainer);
        
        // Ajouter la barre d'action à la page
        const swaggerInfo = document.querySelector('.swagger-ui .information-container');
        if (swaggerInfo) {
          swaggerInfo.parentNode.insertBefore(actionBar, swaggerInfo);
        } else {
          // Si le conteneur d'information n'est pas trouvé, ajouter au body
          document.body.insertBefore(actionBar, document.getElementById('swagger-ui'));
        }
        
        return actionBar;
      };
      
      // Attendre que Swagger UI soit chargé
      setTimeout(() => {
        createActionBar();
        console.log('Barre d\'actions ajoutée avec succès');
      }, 1000);
    };
    
    // Exécuter immédiatement
    addButtonsDirectly();
    
    // Note: cette ancienne fonction a été remplacée par addButtonsDirectly
    
    // On n'a plus besoin d'attendre pour addTempKeyButton car le bouton est déjà ajouté
    // par addButtonsDirectly qui est appelé immédiatement
    
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