/**
 * Middleware d'authentification par clé API
 */
import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/apiKeyService';
import { getApplicationById } from '../db/database';

/**
 * Middleware qui vérifie la présence et la validité d'une clé API
 * 
 * @param req - Requête Express
 * @param res - Réponse Express
 * @param next - Fonction de callback Express
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Extraire la clé API de l'en-tête Authorization ou du paramètre de requête
  const authHeader = req.headers.authorization;
  const queryApiKey = req.query.apiKey as string;
  
  let apiKey: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Extraire la clé de l'en-tête Authorization
    apiKey = authHeader.slice(7);
  } else if (queryApiKey) {
    // Utiliser la clé du paramètre de requête
    apiKey = queryApiKey;
  }
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Clé API requise'
    });
  }
  
  // Valider la clé API
  const validatedApiKey = validateApiKey(apiKey);
  
  if (!validatedApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Clé API invalide ou révoquée'
    });
  }
  
  // Récupérer l'application associée à la clé API
  const application = getApplicationById(validatedApiKey.application_id);
  
  if (!application || !application.is_active) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Application inactive ou inexistante'
    });
  }
  
  // Vérifier les restrictions CORS si nécessaire
  if (application.cors_domain) {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, application.cors_domain)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Origine non autorisée'
      });
    }
  }
  
  // Enrichir la requête avec les informations de la clé API et de l'application
  req.apiKey = validatedApiKey;
  req.application = application;
  
  next();
}

/**
 * Vérifie si l'origine est autorisée pour une application
 * 
 * @param origin - Origine de la requête
 * @param allowedDomain - Domaine autorisé (peut contenir des jokers *)
 * @returns true si l'origine est autorisée
 */
function isOriginAllowed(origin: string, allowedDomain: string): boolean {
  // Si le domaine autorisé est '*', toutes les origines sont autorisées
  if (allowedDomain === '*') {
    return true;
  }
  
  try {
    const originUrl = new URL(origin);
    
    // Convertir le domaine autorisé en expression régulière
    const regexPattern = allowedDomain
      .replace(/\./g, '\\.')  // Échapper les points
      .replace(/\*/g, '.*');  // Remplacer les jokers par .*
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    return regex.test(originUrl.hostname);
  } catch (e) {
    return false;
  }
}