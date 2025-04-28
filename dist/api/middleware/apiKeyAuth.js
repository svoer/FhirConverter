"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyAuth = apiKeyAuth;
const apiKeyService_1 = require("../services/apiKeyService");
const database_1 = require("../db/database");
/**
 * Middleware qui vérifie la présence et la validité d'une clé API
 *
 * @param req - Requête Express
 * @param res - Réponse Express
 * @param next - Fonction de callback Express
 */
function apiKeyAuth(req, res, next) {
    // Extraire la clé API de l'en-tête Authorization ou du paramètre de requête
    const authHeader = req.headers.authorization;
    const queryApiKey = req.query.apiKey;
    let apiKey;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Extraire la clé de l'en-tête Authorization
        apiKey = authHeader.slice(7);
    }
    else if (queryApiKey) {
        // Utiliser la clé du paramètre de requête
        apiKey = queryApiKey;
    }
    if (!apiKey) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Clé API requise'
        });
        return;
    }
    // Valider la clé API
    const validatedApiKey = (0, apiKeyService_1.validateApiKey)(apiKey);
    if (!validatedApiKey) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Clé API invalide ou révoquée'
        });
        return;
    }
    // Récupérer l'application associée à la clé API
    const application = (0, database_1.getApplicationById)(validatedApiKey.application_id);
    if (!application || !application.is_active) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Application inactive ou inexistante'
        });
        return;
    }
    // Vérifier les restrictions CORS si nécessaire
    if (application.cors_domain) {
        const origin = req.headers.origin;
        if (origin && !isOriginAllowed(origin, application.cors_domain)) {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Origine non autorisée'
            });
            return;
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
function isOriginAllowed(origin, allowedDomain) {
    // Si le domaine autorisé est '*', toutes les origines sont autorisées
    if (allowedDomain === '*') {
        return true;
    }
    try {
        const originUrl = new URL(origin);
        // Convertir le domaine autorisé en expression régulière
        const regexPattern = allowedDomain
            .replace(/\./g, '\\.') // Échapper les points
            .replace(/\*/g, '.*'); // Remplacer les jokers par .*
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(originUrl.hostname);
    }
    catch (e) {
        return false;
    }
}
