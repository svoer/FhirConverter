/**
 * Authentication middleware for FHIRHub API
 */
const config = require('../config');

/**
 * API Key authentication middleware
 * Verifies that requests include a valid API key
 */
function apiKeyAuth(req, res, next) {
  // Get API key from request header or query parameter
  const apiKey = req.header('X-API-Key') || req.query.apiKey;
  
  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'API key is required'
    });
  }
  
  // Check if API key is valid
  if (apiKey !== config.apiKey) {
    return res.status(403).json({
      error: 'Authentication failed',
      message: 'Invalid API key'
    });
  }
  
  // API key is valid, proceed to the next middleware/route handler
  next();
}

module.exports = {
  apiKeyAuth
};