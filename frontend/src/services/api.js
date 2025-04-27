/**
 * API service for communicating with the FHIRHub backend
 */

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint path
 * @param {string} apiKey - API key for authentication
 * @param {Object} options - Fetch options
 * @returns {Promise} Response data
 */
async function apiRequest(endpoint, apiKey, options = {}) {
  const url = `/api${endpoint}`;
  
  // Set up headers with API key
  const headers = {
    'X-API-Key': apiKey,
    ...options.headers
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get conversion statistics
 * @param {string} apiKey - API key for authentication
 * @returns {Promise} Stats data
 */
async function getStats(apiKey) {
  return apiRequest('/stats', apiKey);
}

/**
 * Get conversion history
 * @param {string} apiKey - API key for authentication
 * @param {number} limit - Maximum number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise} Conversion history data
 */
async function getConversions(apiKey, limit = 100, offset = 0) {
  return apiRequest(`/conversions?limit=${limit}&offset=${offset}`, apiKey);
}

/**
 * Get a specific FHIR resource by filename
 * @param {string} apiKey - API key for authentication
 * @param {string} filename - FHIR file name
 * @returns {Promise} FHIR resource data
 */
async function getFhirResource(apiKey, filename) {
  return apiRequest(`/fhir/${filename}`, apiKey);
}

/**
 * Upload an HL7 file
 * @param {string} apiKey - API key for authentication
 * @param {File} file - File object to upload
 * @returns {Promise} Upload result
 */
async function uploadHl7File(apiKey, file) {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiRequest('/upload', apiKey, {
    method: 'POST',
    body: formData
  });
}

/**
 * Convert HL7 message to FHIR
 * @param {string} apiKey - API key for authentication
 * @param {string} hl7 - HL7 message content
 * @param {string} filename - Original file name (optional)
 * @returns {Promise} Conversion result with FHIR data
 */
async function convertHl7(apiKey, hl7, filename = null) {
  return apiRequest('/convert', apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hl7,
      filename
    })
  });
}

/**
 * Get a specific conversion by ID
 * @param {string} apiKey - API key for authentication
 * @param {string} id - Conversion ID
 * @returns {Promise} Conversion data
 */
async function getConversionById(apiKey, id) {
  return apiRequest(`/conversions/${id}`, apiKey);
}