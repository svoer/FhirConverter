/**
 * Routes pour le développement et tests des API par l'administrateur
 * Ces routes sont uniquement accessibles aux utilisateurs administrateurs
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Clé secrète pour vérifier les JWT
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

/**
 * @swagger
 * tags:
 *   name: Admin API
 *   description: API pour les administrateurs
 */

/**
 * @swagger
 * /api/dev/key:
 *   get:
 *     summary: Récupérer la clé API de développement
 *     description: Récupère la clé API de développement pour les tests (uniquement administrateurs)
 *     tags:
 *       - Admin API
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Clé API récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: string
 *                       description: Clé API de développement
 *                       example: dev-key
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès interdit (utilisateur non administrateur)
 */
router.get('/key', (req, res) => {
  try {
    // Vérifier si l'utilisateur est authentifié avec un JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentification requise'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier si l'utilisateur est admin dans la base de données
    const db = req.app.locals.db;
    const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(decoded.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    // Récupérer la clé API de développement
    const apiKey = db.prepare(`SELECT key FROM api_keys WHERE key = 'dev-key' LIMIT 1`).get();
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API de développement non trouvée'
      });
    }
    
    // Retourner la clé API
    return res.status(200).json({
      success: true,
      data: {
        apiKey: apiKey.key,
        note: "Utilisez cette clé dans l'en-tête X-API-KEY pour tester les API"
      }
    });
  } catch (error) {
    console.error('[DEV API]', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token invalide ou expiré'
    });
  }
});

/**
 * @swagger
 * /api/dev/all-in-one:
 *   get:
 *     summary: Endpoint tout-en-un pour tester l'authentification
 *     description: Utilisé pour tester l'authentification combinée JWT + API Key (uniquement administrateurs)
 *     tags:
 *       - Admin API
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test réussi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Autorisation réussie ! Vous pouvez utiliser l'API sans restriction.
 *       401:
 *         description: Non autorisé
 */
router.get('/all-in-one', (req, res) => {
  try {
    // Vérifier si l'utilisateur est authentifié avec un JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentification requise'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier si l'utilisateur est admin dans la base de données
    const db = req.app.locals.db;
    const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(decoded.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    // Récupérer la clé API de développement et l'ajouter à l'en-tête pour les requêtes futures
    const apiKey = db.prepare(`SELECT key FROM api_keys WHERE key = 'dev-key' LIMIT 1`).get();
    
    if (apiKey) {
      // Ajouter la clé API aux en-têtes pour les requêtes futures (ne marche pas directement, mais utile pour le débogage)
      req.headers['x-api-key'] = apiKey.key;
    }
    
    // Retourner un message de succès
    return res.status(200).json({
      success: true,
      data: {
        message: "Autorisation réussie ! Vous pouvez utiliser l'API sans restriction.",
        api_key: "dev-key", // On affiche la clé directement pour faciliter les tests
        user: {
          id: decoded.id,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('[DEV API]', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Token invalide ou expiré'
    });
  }
});

module.exports = router;