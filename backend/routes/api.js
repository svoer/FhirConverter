/**
 * API routes for FHIRHub
 * Provides endpoints for conversion, file access, and conversion history
 */
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const config = require('../config');
const { apiKeyAuth } = require('../middleware/auth');
const converter = require('../services/hl7ToFhirConverter');
const fileMonitor = require('../services/fileMonitor');
const db = require('../db/inMemoryDb');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply API key authentication to all routes
router.use(apiKeyAuth);

/**
 * Get conversion logs
 */
router.get('/conversions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const conversions = db.getConversions(limit, offset);
    
    res.json({
      success: true,
      data: conversions,
      meta: {
        limit,
        offset,
        total: conversions.length
      }
    });
  } catch (error) {
    console.error('Error fetching conversion logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversion logs',
      message: error.message
    });
  }
});

/**
 * Get conversion statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching conversion statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversion statistics',
      message: error.message
    });
  }
});

/**
 * Get a specific conversion by ID
 */
router.get('/conversions/:id', (req, res) => {
  try {
    const conversion = db.getConversionById(req.params.id);
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'Conversion not found',
        message: `No conversion found with ID ${req.params.id}`
      });
    }
    
    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error(`Error fetching conversion with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversion',
      message: error.message
    });
  }
});

/**
 * Get a specific converted FHIR file
 */
router.get('/fhir/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(config.paths.outputDir, filename);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const jsonContent = JSON.parse(fileContent);
      
      res.json({
        success: true,
        data: jsonContent
      });
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'FHIR file not found',
          message: `The file '${filename}' does not exist`
        });
      }
      throw fileError;
    }
  } catch (error) {
    console.error('Error fetching FHIR file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FHIR file',
      message: error.message
    });
  }
});

/**
 * Convert HL7 message to FHIR
 */
router.post('/convert', async (req, res) => {
  try {
    const hl7Message = req.body.hl7;
    const filename = req.body.filename || `hl7_${uuidv4()}.hl7`;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Missing HL7 message',
        message: 'Please provide the HL7 message in the request body'
      });
    }
    
    // Convert HL7 to FHIR
    const result = await converter.convertWithFallback(hl7Message);
    
    // Generate output filename
    const outputFileName = filename.replace(/\.[^.]+$/, '.json');
    const outputPath = path.join(config.paths.outputDir, outputFileName);
    
    // Log the conversion
    const logEntry = db.logConversion({
      inputFile: filename,
      outputFile: outputFileName,
      success: result.success,
      timestamp: new Date(),
      message: result.message || result.error,
    });
    
    if (result.success) {
      // Save FHIR output to file
      await fs.mkdir(config.paths.outputDir, { recursive: true });
      await fs.writeFile(
        outputPath,
        JSON.stringify(result.data, null, 2),
        'utf8'
      );
      
      res.json({
        success: true,
        data: result.data,
        message: 'Conversion completed successfully',
        meta: {
          conversionId: logEntry.id,
          outputFile: outputFileName
        }
      });
    } else {
      res.status(422).json({
        success: false,
        error: result.error,
        message: result.message || 'Conversion failed',
        meta: {
          conversionId: logEntry.id
        }
      });
    }
  } catch (error) {
    console.error('Error converting HL7 message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert HL7 message',
      message: error.message
    });
  }
});

/**
 * Upload an HL7 file for conversion
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Missing file',
        message: 'Please upload an HL7 file'
      });
    }
    
    // Get file content and metadata
    const hl7Message = req.file.buffer.toString('utf8');
    const originalFilename = req.file.originalname || `upload_${uuidv4()}.hl7`;
    
    // Save uploaded file to input directory
    const inputPath = path.join(config.paths.inputDir, originalFilename);
    await fs.mkdir(config.paths.inputDir, { recursive: true });
    await fs.writeFile(inputPath, hl7Message, 'utf8');
    
    // Process the file
    const logEntry = await fileMonitor.processFile(inputPath);
    
    if (logEntry && logEntry.success) {
      res.json({
        success: true,
        message: 'File uploaded and converted successfully',
        meta: {
          conversionId: logEntry.id,
          inputFile: logEntry.inputFile,
          outputFile: logEntry.outputFile
        }
      });
    } else {
      res.status(422).json({
        success: false,
        error: 'Conversion failed',
        message: logEntry ? logEntry.message : 'File uploaded but conversion failed',
        meta: logEntry ? { conversionId: logEntry.id } : {}
      });
    }
  } catch (error) {
    console.error('Error uploading and processing HL7 file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process uploaded file',
      message: error.message
    });
  }
});

module.exports = router;