/**
 * Configuration settings for FHIRHub application
 */
const path = require('path');

// Get configuration from environment variables or use defaults
const config = {
  // Server configuration
  port: process.env.PORT || 5000,
  
  // Authentication
  apiKey: process.env.API_KEY || 'demo-api-key',
  
  // File paths
  paths: {
    inputDir: process.env.INPUT_DIR || path.join(__dirname, '../data/in'),
    outputDir: process.env.OUTPUT_DIR || path.join(__dirname, '../data/out')
  },
  
  // File monitoring settings
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false', // Enabled by default
    fileExtensions: ['.hl7', '.txt'], // File extensions to monitor
    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '5000')
  }
};

module.exports = config;