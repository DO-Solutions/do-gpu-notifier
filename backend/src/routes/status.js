const express = require('express');
const router = express.Router();
const scheduler = require('../utils/scheduler');
const { GPU_TYPES } = require('../config');

// Get available GPU types
router.get('/gpu-types', (req, res) => {
  res.json(Object.keys(GPU_TYPES).map(key => ({
    id: key,
    name: key,
    size: GPU_TYPES[key].size,
    image: GPU_TYPES[key].image
  })));
});

// Get current availability status
router.get('/availability', (req, res) => {
  const status = scheduler.getStatus();
  res.json(status);
});

// Trigger an immediate availability check
router.post('/check-now', async (req, res) => {
  try {
    await scheduler.checkAvailability();
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

