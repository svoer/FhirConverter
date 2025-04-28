"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logConversion = logConversion;
exports.getConversionLogs = getConversionLogs;
const database_1 = require("../db/database");
/**
 * Enregistre un log de conversion
 *
 * @param apiKeyId - ID de la clé API utilisée
 * @param sourceType - Type de source (par exemple, 'HL7v2.5')
 * @param sourceContent - Contenu source (message HL7)
 * @param resultContent - Contenu résultant (FHIR)
 * @param status - Statut de la conversion ('success' ou 'error')
 * @param processingTime - Temps de traitement en millisecondes
 * @param errorMessage - Message d'erreur (optionnel)
 * @returns Log de conversion créé
 */
function logConversion(apiKeyId, sourceType, sourceContent, resultContent, status, processingTime, errorMessage) {
    return (0, database_1.createConversionLog)({
        api_key_id: apiKeyId,
        source_type: sourceType,
        source_content: sourceContent,
        result_content: resultContent,
        status,
        processing_time: processingTime,
        error_message: errorMessage
    });
}
/**
 * Récupère les logs de conversion pour une clé API
 *
 * @param apiKeyId - ID de la clé API
 * @param limit - Nombre maximum de logs à récupérer
 * @param offset - Offset pour la pagination
 * @returns Liste des logs de conversion
 */
function getConversionLogs(apiKeyId, limit = 50, offset = 0) {
    return (0, database_1.getConversionLogsByApiKeyId)(apiKeyId, limit, offset);
}
