/**
 * Middleware d'authentification pour FHIRHub
 * Gère l'authentification des utilisateurs et les autorisations
 */

const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');

// Clé secrète pour JWT (à remplacer par une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub_jwt_secret';

/**
 * Middleware pour vérifier si l'utilisateur est authentifié
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante
 */
function isAuthenticated(req, res, next) {
  // Récupérer le token JWT depuis les cookies ou l'en-tête Authorization
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  // Mode développement : contourner l'authentification
  if (process.env.NODE_ENV === 'development' && !token) {
    console.log('[AUTH] Mode développement: authentification contournée');
    req.user = { id: 1, username: 'admin', role: 'admin' };
    return next();
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié',
      message: 'Vous devez être connecté pour accéder à cette ressource'
    });
  }
  
  try {
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[AUTH] Erreur d\'authentification:', error);
    
    res.status(401).json({
      success: false,
      error: 'Token invalide',
      message: 'Votre session a expiré ou est invalide, veuillez vous reconnecter'
    });
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante
 */
function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié',
      message: 'Vous devez être connecté pour accéder à cette ressource'
    });
  }
  
  // Mode développement : contourner la vérification
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH] Mode développement: vérification admin contournée');
    return next();
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Accès refusé',
      message: 'Vous devez être administrateur pour accéder à cette ressource'
    });
  }
  
  next();
}

/**
 * Middleware pour vérifier si l'utilisateur a accès à une ressource spécifique
 * @param {Function} accessCheckFn - Fonction de vérification d'accès
 * @returns {Function} Middleware
 */
function hasResourceAccess(accessCheckFn) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié',
        message: 'Vous devez être connecté pour accéder à cette ressource'
      });
    }
    
    // Mode développement : contourner la vérification
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH] Mode développement: vérification d\'accès contournée');
      return next();
    }
    
    try {
      const hasAccess = await accessCheckFn(req);
      
      if (!hasAccess && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Accès refusé',
          message: 'Vous n\'avez pas accès à cette ressource'
        });
      }
      
      next();
    } catch (error) {
      console.error('[AUTH] Erreur lors de la vérification d\'accès:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: 'Une erreur est survenue lors de la vérification de vos droits d\'accès'
      });
    }
  };
}

module.exports = {
  isAuthenticated,
  isAdmin,
  hasResourceAccess
};