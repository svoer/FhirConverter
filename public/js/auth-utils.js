/**
 * Utilitaires d'authentification pour FHIRHub
 * Fournit des fonctions pour gérer l'authentification et les tokens JWT
 */

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {boolean} true si l'utilisateur est authentifié
 */
function isAuthenticated() {
  return localStorage.getItem('token') !== null;
}

/**
 * Récupère le token JWT stocké
 * @returns {string|null} Le token JWT ou null s'il n'existe pas
 */
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
 * Récupère les informations de l'utilisateur connecté
 * @returns {Object|null} Les informations de l'utilisateur ou null
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (e) {
    console.error('Erreur lors de la lecture des informations utilisateur:', e);
    return null;
  }
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 * @param {string} role - Le rôle à vérifier
 * @returns {boolean} true si l'utilisateur a le rôle spécifié
 */
function hasRole(role) {
  const user = getCurrentUser();
  return user && user.role === role;
}

/**
 * Vérifie si l'utilisateur est administrateur
 * @returns {boolean} true si l'utilisateur est administrateur
 */
function isAdmin() {
  return hasRole('admin');
}

/**
 * Déconnecte l'utilisateur
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

/**
 * Effectue une requête API avec authentification JWT ou clé API
 * @param {string} url - L'URL de la requête
 * @param {Object} options - Options de la requête fetch
 * @param {boolean} useApiKey - Utiliser la clé API par défaut au lieu du JWT
 * @returns {Promise<Object>} La réponse de la requête parsée en JSON
 */
async function fetchWithAuth(url, options = {}, useApiKey = false) {
  // Copier les options pour ne pas modifier l'objet original
  const authOptions = { ...options };
  
  // Initialiser les headers s'ils n'existent pas
  authOptions.headers = authOptions.headers || {};
  authOptions.headers['Content-Type'] = 'application/json';
  
  if (useApiKey) {
    // Utiliser la clé API par défaut pour l'authentification
    authOptions.headers['X-API-KEY'] = 'dev-key';
  } else {
    // Utiliser le JWT pour l'authentification
    const token = getAuthToken();
    
    if (!token) {
      console.error('Erreur: Token d\'authentification manquant');
      // Rediriger vers la page de login en cas d'absence de token
      window.location.href = '/login.html';
      throw new Error('Utilisateur non authentifié');
    }
    
    // Ajouter le header d'autorisation JWT
    authOptions.headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    // Effectuer la requête
    const response = await fetch(url, authOptions);
    
    // Vérifier si la réponse est un succès (status 200-299)
    if (!response.ok) {
      // Gérer les erreurs d'authentification
      if (response.status === 401 || response.status === 403) {
        console.error(`Erreur d'authentification (${response.status}) lors de l'accès à ${url}`);
        // Rediriger vers la page de login automatiquement
        window.location.href = '/login.html';
        throw new Error(`Erreur d'authentification: ${response.statusText}`);
      }
      
      console.error(`Erreur ${response.status} lors de la requête à ${url}: ${response.statusText}`);
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }
    
    // Essayer de parser la réponse en JSON
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erreur lors de la requête à ${url}:`, error);
    // Relancer l'erreur pour la gestion par l'appelant
    throw error;
  }
}

/**
 * Gère la redirection si l'utilisateur n'est pas authentifié
 */
function checkAuthentication() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
  }
}

/**
 * Vérifie les droits d'administration et redirige si nécessaire
 * @returns {boolean} true si l'utilisateur est admin, false sinon
 */
function checkAdminRights() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  
  if (!isAdmin()) {
    alert('Vous n\'avez pas les droits d\'accès à cette page.');
    window.location.href = '/dashboard.html';
    return false;
  }
  
  return true;
}

/**
 * Vérifie si l'utilisateur possède l'un des rôles spécifiés et redirige si nécessaire
 * @param {Array<string>} allowedRoles - Liste des rôles autorisés
 * @param {string} redirectPath - Chemin de redirection si l'utilisateur n'a pas les droits
 * @returns {boolean} true si l'utilisateur a au moins un des rôles autorisés, false sinon
 */
function checkUserRole(allowedRoles, redirectPath = '/login.html') {
  // Vérifier l'authentification
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  
  // Récupérer l'utilisateur courant
  const user = getCurrentUser();
  if (!user || !user.role) {
    window.location.href = '/login.html';
    return false;
  }
  
  // Vérifier si l'utilisateur a au moins un des rôles autorisés
  if (!allowedRoles.includes(user.role)) {
    alert('Vous n\'avez pas les droits d\'accès à cette page.');
    window.location.href = redirectPath;
    return false;
  }
  
  return true;
}

/**
 * Initialise les gestionnaires d'événements communs pour l'authentification
 */
function initAuthListeners() {
  // Gestionnaire pour le lien de déconnexion
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // Afficher le nom d'utilisateur s'il existe
  const usernameElement = document.getElementById('username');
  if (usernameElement) {
    const user = getCurrentUser();
    if (user) {
      usernameElement.textContent = user.username;
    }
  }
  
  // Injecter le chatbot si l'utilisateur est authentifié et si ce n'est pas la page de login
  if (isAuthenticated() && !window.location.pathname.includes('login.html')) {
    injectChatbot();
  }
}

/**
 * Injecte dynamiquement le chatbot dans la page courante
 */
function injectChatbot() {
  // Vérifier si on est sur la page de login
  if (window.location.pathname.includes('login.html')) {
    return;
  }
  
  // Vérifier si le chatbot est déjà injecté
  if (document.getElementById('fhirhub-chatbot') || 
      document.querySelector('script[src="/js/support-chatbot.js"]')) {
    return;
  }
  
  // Injecter le CSS du chatbot
  const chatbotCss = document.createElement('link');
  chatbotCss.rel = 'stylesheet';
  chatbotCss.href = '/css/support-chatbot.css';
  document.head.appendChild(chatbotCss);
  
  // Injecter Font Awesome si nécessaire
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }
  
  // Injecter le JS du chatbot
  const chatbotJs = document.createElement('script');
  chatbotJs.src = '/js/support-chatbot.js';
  chatbotJs.defer = true;
  
  // S'assurer que le script est chargé après que le document soit complètement prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(chatbotJs);
    });
  } else {
    document.body.appendChild(chatbotJs);
  }
}

/**
 * Fonction spéciale pour les iframes qui détecte si l'iframe est chargée dans settings.html
 * et utilise le token d'authentification de la page parent
 */
function setupIframeAuth() {
  // Détecter si nous sommes dans une iframe
  if (window.parent !== window) {
    try {
      // Essayer d'accéder à la page parent (même origine)
      if (window.parent.FHIRHubAuth) {
        // Récupérer les infos d'authentification depuis la page parent
        const parentToken = window.parent.FHIRHubAuth.getAuthToken();
        const parentUser = window.parent.FHIRHubAuth.getCurrentUser();
        
        if (parentToken && parentUser) {
          // Stocker les informations localement pour cette iframe
          localStorage.setItem('token', parentToken);
          localStorage.setItem('user', JSON.stringify(parentUser));
          console.log('Authentification iframe synchronisée avec la page parent');
        }
      }
    } catch (e) {
      console.error('Erreur lors de la synchronisation d\'authentification avec la page parent:', e);
    }
  }
}

// Appeler automatiquement la fonction setupIframeAuth au chargement
document.addEventListener('DOMContentLoaded', setupIframeAuth);

// Exporter les fonctions pour usage global
window.FHIRHubAuth = {
  isAuthenticated,
  getAuthToken,
  getCurrentUser,
  hasRole,
  isAdmin,
  logout,
  fetchWithAuth,
  checkAuthentication,
  checkAdminRights,
  checkUserRole,
  initAuthListeners,
  injectChatbot,
  setupIframeAuth
};