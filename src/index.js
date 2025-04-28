/**
 * Point d'entrée principal de l'application FHIRHub
 * Ce module permet de structurer les imports et exports
 * 
 * @module index
 * @author FHIRHub Team
 */

const services = require('./services');
const utils = require('./utils');

module.exports = {
  services,
  utils
};