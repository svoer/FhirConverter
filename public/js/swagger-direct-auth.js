/**
 * Script pour intégrer les champs d'authentification directement dans l'interface de Swagger
 * Élimine le besoin de cliquer sur le bouton d'authentification
 */
(function() {
  // Attendre que Swagger UI soit chargé
  function waitForSwaggerUI() {
    if (document.querySelector('.swagger-ui')) {
      setupDirectAuth();
    } else {
      setTimeout(waitForSwaggerUI, 100);
    }
  }

  // Configurer l'authentification directe
  function setupDirectAuth() {
    console.log('[Swagger] Mise en place de l\'authentification directe...');
    
    // Récupérer les éléments de l'interface
    const swaggerUI = document.querySelector('.swagger-ui');
    const infoContainer = swaggerUI.querySelector('.information-container');
    
    if (!infoContainer) {
      console.error('[Swagger] Container d\'information non trouvé');
      return;
    }
    
    // Créer un conteneur pour notre formulaire d'authentification
    const authContainer = document.createElement('div');
    authContainer.className = 'direct-auth-container';
    authContainer.style.cssText = `
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      margin: 15px 0;
      border: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    `;
    
    // Créer le titre du formulaire
    const authTitle = document.createElement('h3');
    authTitle.textContent = 'Authentification API';
    authTitle.style.cssText = `
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 16px;
      color: #333;
    `;
    
    // Créer des onglets pour différentes méthodes d'authentification
    const authTabs = document.createElement('div');
    authTabs.className = 'auth-tabs';
    authTabs.style.cssText = `
      display: flex;
      border-bottom: 1px solid #dee2e6;
      margin-bottom: 15px;
    `;
    
    // Onglet API Key
    const apiKeyTab = document.createElement('div');
    apiKeyTab.className = 'auth-tab active';
    apiKeyTab.setAttribute('data-tab', 'apiKey');
    apiKeyTab.textContent = 'Clé API';
    apiKeyTab.style.cssText = `
      padding: 8px 15px;
      cursor: pointer;
      border-bottom: 2px solid #ff5722;
      font-weight: bold;
      color: #ff5722;
    `;
    
    // Onglet JWT
    const jwtTab = document.createElement('div');
    jwtTab.className = 'auth-tab';
    jwtTab.setAttribute('data-tab', 'jwt');
    jwtTab.textContent = 'JWT Bearer';
    jwtTab.style.cssText = `
      padding: 8px 15px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      color: #6c757d;
    `;
    
    // Ajouter les onglets au conteneur
    authTabs.appendChild(apiKeyTab);
    authTabs.appendChild(jwtTab);
    
    // Créer le contenu des onglets
    const tabContents = document.createElement('div');
    tabContents.className = 'tab-contents';
    
    // Contenu pour l'onglet API Key
    const apiKeyContent = document.createElement('div');
    apiKeyContent.className = 'tab-content apiKey active';
    apiKeyContent.style.display = 'block';
    
    // Formulaire pour API Key
    const apiKeyForm = document.createElement('div');
    apiKeyForm.style.cssText = `
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    `;
    
    // Input pour la clé API
    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'text';
    apiKeyInput.placeholder = 'Entrez votre clé API';
    apiKeyInput.value = 'dev-key'; // Valeur par défaut
    apiKeyInput.style.cssText = `
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    // Bouton d'application de la clé API
    const apiKeyButton = document.createElement('button');
    apiKeyButton.textContent = 'Appliquer';
    apiKeyButton.style.cssText = `
      background: linear-gradient(to right, #e74c3c, #ff5722);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      min-width: 100px;
    `;
    
    // Note d'aide pour la clé API
    const apiKeyHelp = document.createElement('div');
    apiKeyHelp.innerHTML = '<small>La clé de test <strong>dev-key</strong> est disponible pour tester les API.</small>';
    apiKeyHelp.style.cssText = `
      width: 100%;
      color: #6c757d;
      margin-top: 5px;
      font-size: 12px;
    `;
    
    // Ajouter les éléments au formulaire API Key
    apiKeyForm.appendChild(apiKeyInput);
    apiKeyForm.appendChild(apiKeyButton);
    apiKeyContent.appendChild(apiKeyForm);
    apiKeyContent.appendChild(apiKeyHelp);
    
    // Contenu pour l'onglet JWT
    const jwtContent = document.createElement('div');
    jwtContent.className = 'tab-content jwt';
    jwtContent.style.display = 'none';
    
    // Formulaire pour JWT
    const jwtForm = document.createElement('div');
    jwtForm.style.cssText = `
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    `;
    
    // Input pour le JWT
    const jwtInput = document.createElement('input');
    jwtInput.type = 'text';
    jwtInput.placeholder = 'Entrez votre JWT Bearer Token';
    // Récupérer le token du localStorage s'il existe
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      jwtInput.value = savedToken;
    }
    jwtInput.style.cssText = `
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    // Bouton d'application du JWT
    const jwtButton = document.createElement('button');
    jwtButton.textContent = 'Appliquer';
    jwtButton.style.cssText = `
      background: linear-gradient(to right, #e74c3c, #ff5722);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      min-width: 100px;
    `;
    
    // Note d'aide pour le JWT
    const jwtHelp = document.createElement('div');
    jwtHelp.innerHTML = '<small>Le token JWT est généré lors de la connexion via /api/login.</small>';
    jwtHelp.style.cssText = `
      width: 100%;
      color: #6c757d;
      margin-top: 5px;
      font-size: 12px;
    `;
    
    // Ajouter les éléments au formulaire JWT
    jwtForm.appendChild(jwtInput);
    jwtForm.appendChild(jwtButton);
    jwtContent.appendChild(jwtForm);
    jwtContent.appendChild(jwtHelp);
    
    // Ajouter les contenus d'onglets
    tabContents.appendChild(apiKeyContent);
    tabContents.appendChild(jwtContent);
    
    // Ajouter tous les éléments au conteneur d'authentification
    authContainer.appendChild(authTitle);
    authContainer.appendChild(authTabs);
    authContainer.appendChild(tabContents);
    
    // Insérer le conteneur d'authentification après le conteneur d'information
    infoContainer.parentNode.insertBefore(authContainer, infoContainer.nextSibling);
    
    // Fonctionnalité pour les onglets
    const tabs = authContainer.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Réinitialiser tous les onglets
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.borderBottom = '2px solid transparent';
          t.style.color = '#6c757d';
          t.style.fontWeight = 'normal';
        });
        
        // Activer l'onglet cliqué
        tab.classList.add('active');
        tab.style.borderBottom = '2px solid #ff5722';
        tab.style.color = '#ff5722';
        tab.style.fontWeight = 'bold';
        
        // Masquer tous les contenus d'onglets
        const tabContents = authContainer.querySelectorAll('.tab-content');
        tabContents.forEach(tc => {
          tc.style.display = 'none';
        });
        
        // Afficher le contenu correspondant à l'onglet
        const tabContentToShow = authContainer.querySelector('.tab-content.' + tab.getAttribute('data-tab'));
        if (tabContentToShow) {
          tabContentToShow.style.display = 'block';
        }
      });
    });
    
    // Action pour le bouton API Key
    apiKeyButton.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) return;
      
      console.log('[Swagger] Application de la clé API: ' + apiKey);
      
      // Appliquer la clé API à toutes les opérations
      applyAuthToOperations('apiKey', apiKey);
      
      // Ajouter un message de confirmation
      showSuccessMessage('Clé API appliquée avec succès !');
    });
    
    // Action pour le bouton JWT
    jwtButton.addEventListener('click', () => {
      const jwt = jwtInput.value.trim();
      if (!jwt) return;
      
      console.log('[Swagger] Application du JWT: ' + jwt);
      
      // Appliquer le JWT à toutes les opérations
      applyAuthToOperations('Bearer', jwt);
      
      // Ajouter un message de confirmation
      showSuccessMessage('Token JWT appliqué avec succès !');
    });
    
    // Fonction pour appliquer l'authentification à toutes les opérations
    function applyAuthToOperations(authType, authValue) {
      // Stocke le token JWT dans le localStorage si c'est un Bearer
      if (authType === 'Bearer') {
        localStorage.setItem('token', authValue);
      }
      
      // Trouver le bouton Authorize original (mais ne pas cliquer dessus pour éviter le modal)
      const authorizeButton = document.querySelector('.swagger-ui .auth-wrapper .authorize');
      if (!authorizeButton) {
        console.error("[Swagger] Bouton d'autorisation non trouvé");
        return;
      }
      
      try {
        // Cliquer sur le bouton Authorize original
        authorizeButton.click();
        
        // Attendre que le modal apparaisse
        setTimeout(() => {
          // Trouver les champs d'entrée pour les différents types d'auth
          if (authType === 'apiKey') {
            const apiKeyInput = document.querySelector('.swagger-ui .auth-container input[placeholder*="api_key"], .swagger-ui .auth-container input[placeholder*="apiKey"]');
            if (apiKeyInput) {
              apiKeyInput.value = authValue;
              // Déclencher l'événement input pour que Swagger détecte la modification
              const inputEvent = new Event('input', { bubbles: true });
              apiKeyInput.dispatchEvent(inputEvent);
            }
          } else if (authType === 'Bearer') {
            const bearerInput = document.querySelector('.swagger-ui .auth-container input[placeholder*="Bearer"]');
            if (bearerInput) {
              bearerInput.value = authValue;
              // Déclencher l'événement input pour que Swagger détecte la modification
              const inputEvent = new Event('input', { bubbles: true });
              bearerInput.dispatchEvent(inputEvent);
            }
          }
          
          // Cliquer sur le bouton Authorize du modal
          const authorizeBtn = document.querySelector('.swagger-ui .auth-btn-wrapper .btn-done');
          if (authorizeBtn) {
            authorizeBtn.click();
            console.log('[Swagger] Authentification appliquée avec succès');
          } else {
            console.error('[Swagger] Bouton Authorize non trouvé dans le modal');
          }
        }, 300);
      } catch (err) {
        console.error('[Swagger] Erreur lors de l\'authentification:', err);
      }
    }
    
    // Fonction pour afficher un message de succès
    function showSuccessMessage(message) {
      const existingMsg = document.querySelector('.auth-success-message');
      if (existingMsg) {
        existingMsg.remove();
      }
      
      const msgElement = document.createElement('div');
      msgElement.className = 'auth-success-message';
      msgElement.textContent = message;
      msgElement.style.cssText = `
        background-color: #d4edda;
        color: #155724;
        padding: 10px 15px;
        border-radius: 4px;
        margin-top: 10px;
        animation: fadeOut 3s forwards 1s;
      `;
      
      // Ajouter une animation de disparition
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(styleElement);
      
      // Ajouter le message au conteneur
      authContainer.appendChild(msgElement);
      
      // Supprimer le message après l'animation
      setTimeout(() => {
        msgElement.remove();
      }, 4000);
    }
    
    // Appliquer automatiquement l'authentification par défaut
    setTimeout(() => {
      // Appliquer la clé API par défaut
      if (apiKeyInput.value) {
        apiKeyButton.click();
      }
      
      // Si un JWT est présent, basculer vers cet onglet et l'appliquer
      if (jwtInput.value) {
        jwtTab.click();
        setTimeout(() => {
          jwtButton.click();
        }, 300);
      }
    }, 1000);
    
    // Cacher complètement le bouton d'authentification original après un certain temps
    setTimeout(() => {
      const authButtons = document.querySelectorAll('.swagger-ui .auth-wrapper');
      authButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    }, 2000);
    
    console.log('[Swagger] Authentification directe configurée avec succès');
  }
  
  // Démarrer l'initialisation
  waitForSwaggerUI();
})();