/**
 * Point d'entrée uniformisé pour l'adaptateur de terminologie française
 * Résout les problèmes de casse dans les imports
 */

// Importer le vrai adaptateur (avec une casse cohérente)
const adapter = require('./src/terminology/FrenchTerminologyAdapter');

// Exporter toutes les fonctions de l'adaptateur
module.exports = adapter;
