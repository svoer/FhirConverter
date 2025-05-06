/**
 * Module de métriques pour FHIRHub
 * Permet d'exposer des métriques pour Prometheus
 */
const express = require('express');
const os = require('os');

// Variables pour stocker les métriques
let conversionCount = 0;
let apiRequestsCount = 0;
let conversionDurationSum = 0;
let conversionDurationCount = 0;
let activeConnections = 0;

// Création de l'application Express pour le serveur de métriques
const metricsApp = express();

// Middleware pour compter les requêtes API
function apiRequestCounter(req, res, next) {
  apiRequestsCount++;
  next();
}

// Fonction pour incrémenter le compteur de conversions
function incrementConversionCount() {
  conversionCount++;
}

// Fonction pour enregistrer la durée d'une conversion
function recordConversionDuration(durationInMs) {
  const durationInSeconds = durationInMs / 1000;
  conversionDurationSum += durationInSeconds;
  conversionDurationCount++;
}

// Fonction pour mettre à jour le nombre de connexions actives
function updateActiveConnections(count) {
  activeConnections = count;
}

// Route pour exposer les métriques
metricsApp.get('/metrics', (req, res) => {
  const metrics = [];

  // Métriques de l'application
  metrics.push('# HELP fhirhub_conversion_count_total Nombre total de conversions HL7 vers FHIR');
  metrics.push('# TYPE fhirhub_conversion_count_total counter');
  metrics.push(`fhirhub_conversion_count_total ${conversionCount}`);

  metrics.push('# HELP fhirhub_api_requests_total Nombre total de requêtes API');
  metrics.push('# TYPE fhirhub_api_requests_total counter');
  metrics.push(`fhirhub_api_requests_total ${apiRequestsCount}`);

  metrics.push('# HELP fhirhub_conversion_duration_seconds Durée des conversions en secondes');
  metrics.push('# TYPE fhirhub_conversion_duration_seconds summary');
  metrics.push(`fhirhub_conversion_duration_seconds_sum ${conversionDurationSum}`);
  metrics.push(`fhirhub_conversion_duration_seconds_count ${conversionDurationCount}`);

  metrics.push('# HELP fhirhub_active_connections Nombre de connexions actives');
  metrics.push('# TYPE fhirhub_active_connections gauge');
  metrics.push(`fhirhub_active_connections ${activeConnections}`);

  // Métriques système
  const memoryUsage = process.memoryUsage();
  metrics.push('# HELP fhirhub_memory_usage_bytes Utilisation mémoire en octets');
  metrics.push('# TYPE fhirhub_memory_usage_bytes gauge');
  metrics.push(`fhirhub_memory_usage_bytes ${memoryUsage.rss}`);

  // CPU usage
  const cpuUsage = process.cpuUsage();
  const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length * 100;
  metrics.push('# HELP fhirhub_cpu_usage_percent Pourcentage d\'utilisation CPU');
  metrics.push('# TYPE fhirhub_cpu_usage_percent gauge');
  metrics.push(`fhirhub_cpu_usage_percent ${cpuUsagePercent.toFixed(2)}`);

  // Uptime
  metrics.push('# HELP fhirhub_uptime_seconds Temps écoulé depuis le démarrage de l\'application');
  metrics.push('# TYPE fhirhub_uptime_seconds counter');
  metrics.push(`fhirhub_uptime_seconds ${process.uptime()}`);

  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

/**
 * Initialisation du serveur de métriques
 * @param {number} port - Port sur lequel le serveur de métriques sera lancé
 */
function startMetricsServer(port = 9091) {
  if (process.env.METRICS_ENABLED === 'true') {
    metricsApp.listen(port, () => {
      console.log(`[METRICS] Serveur de métriques démarré sur le port ${port}`);
    });
    return true;
  } else {
    console.log('[METRICS] Serveur de métriques désactivé');
    return false;
  }
}

module.exports = {
  apiRequestCounter,
  incrementConversionCount,
  recordConversionDuration,
  updateActiveConnections,
  startMetricsServer
};