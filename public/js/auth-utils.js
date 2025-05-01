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
 * Effectue une requête API avec authentification JWT
 * @param {string} url - L'URL de la requête
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Response>} La réponse de la requête
 */
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Utilisateur non authentifié');
  }
  
  // Copier les options pour ne pas modifier l'objet original
  const authOptions = { ...options };
  
  // Initialiser les headers s'ils n'existent pas
  authOptions.headers = authOptions.headers || {};
  
  // Ajouter le header d'autorisation
  authOptions.headers.Authorization = `Bearer ${token}`;
  
  // Effectuer la requête
  return fetch(url, authOptions);
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
  if (document.getElementById('fhirhub-chatbot')) {
    return;
  }
  
  // Injecter le CSS du chatbot
  const chatbotCss = document.createElement('link');
  chatbotCss.rel = 'stylesheet';
  chatbotCss.href = '/css/support-chatbot.css';
  document.head.appendChild(chatbotCss);
  
  // Injecter le JS du chatbot
  const chatbotJs = document.createElement('script');
  chatbotJs.src = '/js/support-chatbot.js';
  chatbotJs.defer = true;
  document.body.appendChild(chatbotJs);
}

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
  injectChatbot
};