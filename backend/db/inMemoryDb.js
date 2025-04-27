/**
 * In-memory database implementation for FHIRHub
 * Stores conversion logs and provides basic query capabilities
 */
const { v4: uuidv4 } = require('uuid');

// In-memory storage for conversion logs
let conversionLogs = [];

/**
 * Log a conversion activity
 * @param {Object} conversionData - Data about the conversion
 * @returns {Object} The saved log entry with ID
 */
function logConversion(conversionData) {
  const timestamp = new Date();
  const id = uuidv4();
  
  const logEntry = {
    id,
    timestamp,
    ...conversionData,
  };
  
  conversionLogs.push(logEntry);
  return logEntry;
}

/**
 * Get all conversion logs
 * @param {number} limit - Maximum number of logs to return
 * @param {number} offset - Number of logs to skip
 * @returns {Array} Array of log entries
 */
function getConversions(limit = 100, offset = 0) {
  // Sort by timestamp descending (newest first)
  const sortedLogs = [...conversionLogs].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  return sortedLogs.slice(offset, offset + limit);
}

/**
 * Get a specific conversion by ID
 * @param {string} id - The ID of the conversion to retrieve
 * @returns {Object|null} The conversion log entry or null if not found
 */
function getConversionById(id) {
  return conversionLogs.find(log => log.id === id) || null;
}

/**
 * Get conversion statistics
 * @returns {Object} Statistics about conversions
 */
function getStats() {
  const totalConversions = conversionLogs.length;
  const successfulConversions = conversionLogs.filter(log => log.success).length;
  const failedConversions = totalConversions - successfulConversions;
  
  // Calculate success rate
  const successRate = totalConversions > 0 
    ? Math.round((successfulConversions / totalConversions) * 100) 
    : 0;
  
  // Count conversions in the last 24 hours
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const conversionsLast24Hours = conversionLogs.filter(log => 
    new Date(log.timestamp) >= last24Hours
  ).length;
  
  return {
    totalConversions,
    successfulConversions,
    failedConversions,
    successRate,
    conversionsLast24Hours
  };
}

/**
 * Clear all conversion logs
 */
function clearAll() {
  conversionLogs = [];
}

module.exports = {
  logConversion,
  getConversions,
  getConversionById,
  getStats,
  clearAll
};