/**
 * Middleware pour l'authentification par JWT
 * 
 * Ce module fournit des fonctionnalités pour l'authentification par token JWT :
 * - generateToken : Génère un token JWT pour un utilisateur
 * - verifyToken : Vérifie la validité d'un token JWT
 * 
 * @module middleware/jwtAuth
 * @see middleware/README.md pour la documentation complète et les exemples
 * @see middleware/authCombined.js pour un middleware combinant JWT et API Key
 */

const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const db = new Database('./storage/db/fhirhub.db', { fileMustExist: false });

// Clé secrète pour signer les tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key-dev-only';
const TOKEN_EXPIRATION = '24h';

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} user - Utilisateur authentifié
 * @returns {string} Token JWT
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
}

/**
 * Vérifie la validité du token JWT
 */
function verifyToken(req, res, next) {
  try {
    // Récupérer le token de l'en-tête Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next ? next('Token JWT requis') : res.status(401).json({ error: 'Token JWT requis' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Pour le développement et les tests, accepter un token spécial "dev-token"
    if (process.env.NODE_ENV !== 'production' && token === 'dev-token') {
      // Utiliser l'utilisateur admin pour le dev-token
      const adminUser = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get('admin', 'admin');
      if (adminUser) {
        req.user = adminUser;
        return next();
      }
    }
    
    // Vérifier et décoder le token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        console.error('[JWT] Erreur de vérification du token:', err.message);
        return next ? next('Token invalide') : res.status(401).json({ error: 'Token invalide ou expiré' });
      }
      
      // Récupérer l'utilisateur correspondant
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      
      if (!user) {
        return next ? next('Utilisateur non trouvé') : res.status(401).json({ error: 'Utilisateur non trouvé' });
      }
      
      // Ajouter l'utilisateur à la requête
      req.user = user;
      
      // Mettre à jour la date de dernière activité
      db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);
      
      next();
    });
  } catch (error) {
    console.error('[JWT] Erreur lors de la vérification du token:', error);
    return next ? next(error) : res.status(500).json({ error: 'Erreur de serveur lors de l\'authentification' });
  }
}

module.exports = {
  generateToken,
  verifyToken
};