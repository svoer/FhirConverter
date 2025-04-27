/**
 * FHIRHub Server
 * Main application entry point
 */
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const config = require('./config');
const apiRoutes = require('./routes/api');
const fileMonitor = require('./services/fileMonitor');

// Create Express application
const app = express();

// Configure middleware
app.use(cors());
app.use(bodyParser.json({
  limit: '10mb'
}));
app.use(bodyParser.urlencoded({
  limit: '10mb',
  extended: true
}));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Register API routes
app.use('/api', apiRoutes);

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'FHIRHub API',
    version: '1.0.0',
    description: 'API for HL7 to FHIR conversion',
    endpoints: [
      { method: 'GET', path: '/api/conversions', description: 'Get conversion logs' },
      { method: 'GET', path: '/api/conversions/:id', description: 'Get a specific conversion' },
      { method: 'GET', path: '/api/stats', description: 'Get conversion statistics' },
      { method: 'GET', path: '/api/fhir/:filename', description: 'Get a converted FHIR file' },
      { method: 'POST', path: '/api/convert', description: 'Convert HL7 message to FHIR' },
      { method: 'POST', path: '/api/upload', description: 'Upload HL7 file for conversion' }
    ]
  });
});

// Create necessary directories
async function createDirectories() {
  try {
    // Create data directories if they don't exist
    await fs.mkdir(config.paths.inputDir, { recursive: true });
    await fs.mkdir(config.paths.outputDir, { recursive: true });
    
    console.log(`Created input directory: ${config.paths.inputDir}`);
    console.log(`Created output directory: ${config.paths.outputDir}`);
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Start the server
async function startServer() {
  try {
    // Create necessary directories
    await createDirectories();
    
    // Start file monitoring
    if (config.monitoring.enabled) {
      fileMonitor.startMonitoring();
      console.log(`File monitoring started for ${config.paths.inputDir}`);
    }
    
    // Start server
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`
╔═════════════════════════════════════════════╗
║                                             ║
║                 FHIRHub                     ║
║       HL7 to FHIR Conversion Service        ║
║                                             ║
╚═════════════════════════════════════════════╝

Server running at http://localhost:${config.port}
API available at http://localhost:${config.port}/api
API Key: ${config.apiKey}
Input directory: ${config.paths.inputDir}
Output directory: ${config.paths.outputDir}
File monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}
      `);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down FHIRHub server...');
  fileMonitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down FHIRHub server...');
  fileMonitor.stopMonitoring();
  process.exit(0);
});

// Start server
startServer();