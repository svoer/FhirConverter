/**
 * Router temporaire pour tester la configuration
 */

const express = require('express');
const router = express.Router();

// Route racine
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API FHIRHub - Test Router'
  });
});

module.exports = router;