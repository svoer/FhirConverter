/**
 * Middleware d'authentification par clé API
 */

import { Request, Response, NextFunction } from 'express';

// Définition pour le type ApiKey
interface ApiKey {
  id: number;
  key: string;
  name: string;
  applicationId: number;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// Extension des types de Request d'Express
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

/**
 * Middleware qui vérifie la validité de la clé API fournie
 * La clé peut être passée dans l'en-tête X-API-KEY ou en paramètre de requête apiKey
 * @param req Request Express
 * @param res Response Express
 * @param next Fonction suivante dans la chaîne de middleware
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Récupérer la clé API depuis les en-têtes ou les paramètres de requête
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // Vérifier que la clé API est fournie
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Clé API manquante'
    });
    return;
  }
  
  // Clé de développement pour les tests (à remplacer par une vérification en base)
  if (apiKey === 'dev-key') {
    const fakeApiKey: ApiKey = {
      id: 1,
      key: 'dev-key',
      name: 'Clé de développement',
      applicationId: 1,
      active: true,
      createdAt: new Date(),
      lastUsedAt: new Date()
    };
    
    req.apiKey = fakeApiKey;
    next();
    return;
  }
  
  // Ici, il faudrait vérifier en base de données si la clé API est valide
  // Pour l'instant, on autorise uniquement la clé de développement
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Clé API invalide'
  });
}