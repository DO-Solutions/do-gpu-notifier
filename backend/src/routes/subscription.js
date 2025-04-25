const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification');
const { GPU_TYPES } = require('../config');

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: notificationService.getPublicVapidKey() });
});

// Subscribe to notifications
router.post('/subscribe', (req, res) => {
  const { userId, subscription, gpuTypes } = req.body;
  
  if (!userId || !subscription) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Validate GPU types if provided
  if (gpuTypes) {
    const validGpuTypes = Object.keys(GPU_TYPES);
    const invalidTypes = gpuTypes.filter(type => !validGpuTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid GPU types', 
        invalidTypes,
        validTypes: validGpuTypes
      });
    }
  }
  
  const result = notificationService.addSubscription(userId, subscription, gpuTypes);
  res.status(201).json(result);
});

// Get subscription info
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const subscription = notificationService.getSubscriptionInfo(userId);
  
  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  
  res.json(subscription);
});

// Update GPU types for subscription
router.put('/:userId/gpu-types', (req, res) => {
  const { userId } = req.params;
  const { gpuTypes } = req.body;
  
  if (!gpuTypes || !Array.isArray(gpuTypes)) {
    return res.status(400).json({ error: 'gpuTypes must be an array' });
  }
  
  // Validate GPU types
  const validGpuTypes = Object.keys(GPU_TYPES);
  const invalidTypes = gpuTypes.filter(type => !validGpuTypes.includes(type));
  
  if (invalidTypes.length > 0) {
    return res.status(400).json({ 
      error: 'Invalid GPU types', 
      invalidTypes,
      validTypes: validGpuTypes
    });
  }
  
  const result = notificationService.updateSubscriptionGpuTypes(userId, gpuTypes);
  
  if (!result) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  
  res.json(result);
});

// Unsubscribe
router.delete('/:userId', (req, res) => {
  const { userId } = req.params;
  const removed = notificationService.removeSubscription(userId);
  
  if (!removed) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  
  res.status(204).end();
});

module.exports = router;

