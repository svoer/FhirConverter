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