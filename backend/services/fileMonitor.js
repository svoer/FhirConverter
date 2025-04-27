/**
 * File monitoring service
 * Monitors a directory for new HL7 files and processes them
 */
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const config = require('../config');
const converter = require('./hl7ToFhirConverter');
const db = require('../db/inMemoryDb');

// Initialize the watcher
let watcher = null;

/**
 * Process a single HL7 file
 * @param {string} filePath - Full path to the HL7 file
 */
async function processFile(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  try {
    // Read the file content
    const content = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Convert HL7 to FHIR
    const result = await converter.convertWithFallback(content);
    
    // Generate output filename
    const outputFileName = fileName.replace(/\.[^.]+$/, '.json');
    const outputPath = path.join(config.paths.outputDir, outputFileName);
    
    // Log the conversion
    const logEntry = db.logConversion({
      inputFile: fileName,
      outputFile: outputFileName,
      success: result.success,
      timestamp: new Date(),
      message: result.message || result.error,
    });
    
    if (result.success) {
      // Save FHIR output to file
      await fs.writeFile(
        outputPath,
        JSON.stringify(result.data, null, 2),
        'utf8'
      );
      console.log(`Conversion successful: ${outputPath}`);
    } else {
      console.error(`Conversion failed for ${fileName}: ${result.error}`);
      
      // Save error information to output file
      await fs.writeFile(
        outputPath,
        JSON.stringify({ error: result.error, message: result.message }, null, 2),
        'utf8'
      );
    }
    
    return logEntry;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    
    // Log the error
    db.logConversion({
      inputFile: path.basename(filePath),
      outputFile: null,
      success: false,
      timestamp: new Date(),
      message: `Error processing file: ${error.message}`,
    });
    
    return null;
  }
}

/**
 * Scan the input directory for new HL7 files
 */
function scanDirectory() {
  const inputDir = config.paths.inputDir;
  
  // Ensure input directory exists
  fs.mkdir(inputDir, { recursive: true })
    .then(() => fs.readdir(inputDir))
    .then(files => {
      // Filter for HL7 files based on extensions
      const extensions = config.monitoring.fileExtensions;
      const hl7Files = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return extensions.includes(ext);
      });
      
      // Process each file
      hl7Files.forEach(file => {
        const filePath = path.join(inputDir, file);
        processFile(filePath);
      });
    })
    .catch(error => {
      console.error('Error scanning directory:', error);
    });
}

/**
 * Start monitoring the input directory
 */
function startMonitoring() {
  if (!config.monitoring.enabled) {
    console.log('File monitoring is disabled in configuration');
    return;
  }
  
  // Ensure directories exist
  fs.mkdir(config.paths.inputDir, { recursive: true })
    .then(() => fs.mkdir(config.paths.outputDir, { recursive: true }))
    .then(() => {
      console.log(`Monitoring directory ${config.paths.inputDir} for HL7 files`);
      
      // Create file watcher
      const extensions = config.monitoring.fileExtensions.map(ext => 
        ext.startsWith('.') ? ext : `.${ext}`
      );
      
      const watchPattern = path.join(
        config.paths.inputDir, 
        `*{${extensions.join(',')}}`
      );
      
      watcher = chokidar.watch(watchPattern, {
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });
      
      // Add event listeners
      watcher.on('add', filePath => {
        console.log(`New file detected: ${filePath}`);
        processFile(filePath);
      });
      
      watcher.on('error', error => {
        console.error('File watcher error:', error);
      });
      
      // Perform initial scan
      scanDirectory();
      
      return true;
    })
    .catch(error => {
      console.error('Error starting file monitoring:', error);
      return false;
    });
}

/**
 * Stop monitoring the input directory
 */
function stopMonitoring() {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('File monitoring stopped');
  }
}

module.exports = {
  processFile,
  scanDirectory,
  startMonitoring,
  stopMonitoring
};