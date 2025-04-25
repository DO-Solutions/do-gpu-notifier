// backend/src/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  DO_API_TOKEN: process.env.DO_API_TOKEN,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  CHECK_INTERVAL: 10000, // 10 seconds
  // Regions to check, empty array means check all regions
  REGIONS_TO_CHECK: (process.env.REGIONS_TO_CHECK || 'nyc1,sfo3,fra1').split(','),
  GPU_TYPES: {
    'L40S': {
      size: 'gpu-l40sx1-48gb',
      image: null // Default image will be used
    },
    'H100-1X': {
      size: 'gpu-h100x1-80gb',
      image: 'gpu-h100x1-base'
    },
    'H100-8X': {
      size: 'gpu-h100x8-640gb',
      image: 'gpu-h100x8-base'
    }
  }
};

// backend/src/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PORT } = require('./config');
const subscriptionRoutes = require('./routes/subscription');
const statusRoutes = require('./routes/status');
const scheduler = require('./utils/scheduler');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/status', statusRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the scheduler to check GPU availability
  scheduler.startChecking();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received, closing server');
  scheduler.stopChecking();
  process.exit(0);
});

// backend/src/services/digitalocean.js
const axios = require('axios');
const { DO_API_TOKEN, GPU_TYPES, REGIONS_TO_CHECK } = require('../config');

const DO_API_URL = 'https://api.digitalocean.com/v2';

// Create axios instance with auth headers
const doApiClient = axios.create({
  baseURL: DO_API_URL,
  headers: {
    'Authorization': `Bearer ${DO_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Checks capacity for a specific GPU type using the capacity API
 * @param {string} gpuType - Key from GPU_TYPES config
 * @returns {Promise<Object>} - Result object with availability status and details
 */
async function checkGpuAvailability(gpuType) {
  if (!GPU_TYPES[gpuType]) {
    throw new Error(`Invalid GPU type: ${gpuType}`);
  }

  const gpuConfig = GPU_TYPES[gpuType];
  
  try {
    // Request capacity information for this size slug
    const response = await doApiClient.get(`/droplets/capacity?size=${gpuConfig.size}`);
    
    if (!response.data || !response.data.capacities || !Array.isArray(response.data.capacities)) {
      return {
        available: false,
        gpuType,
        message: 'Invalid response from DigitalOcean API',
        error: 'invalid_response',
        details: { 
          size: gpuConfig.size, 
          image: gpuConfig.image 
        }
      };
    }
    
    // Filter regions if specified in config
    const capacities = REGIONS_TO_CHECK && REGIONS_TO_CHECK.length > 0
      ? response.data.capacities.filter(cap => REGIONS_TO_CHECK.includes(cap.region))
      : response.data.capacities;
    
    if (capacities.length === 0) {
      return {
        available: false,
        gpuType,
        message: 'No capacity information available for specified regions',
        error: 'no_regions',
        details: { 
          size: gpuConfig.size, 
          image: gpuConfig.image 
        }
      };
    }
    
    // Check if any region has capacity
    const availableRegions = capacities.filter(cap => 
      cap.capacity === 'HIGH' || cap.capacity === 'MEDIUM'
    );
    
    if (availableRegions.length > 0) {
      return {
        available: true,
        gpuType,
        message: `GPU is available in ${availableRegions.length} region(s)`,
        details: { 
          size: gpuConfig.size, 
          image: gpuConfig.image,
          regions: availableRegions.map(r => ({ 
            region: r.region, 
            capacity: r.capacity 
          }))
        }
      };
    } else {
      // Find regions with the lowest capacity
      const lowestCapacity = capacities.reduce((lowest, current) => {
        if (!lowest || current.capacity.toLowerCase() < lowest.toLowerCase()) {
          return current.capacity;
        }
        return lowest;
      }, null);
      
      return {
        available: false,
        gpuType,
        message: `GPU is not available (Best capacity: ${lowestCapacity || 'NONE'})`,
        error: 'no_capacity',
        details: { 
          size: gpuConfig.size, 
          image: gpuConfig.image,
          regions: capacities.map(r => ({ 
            region: r.region, 
            capacity: r.capacity 
          }))
        }
      };
    }
  } catch (error) {
    console.error(`Error checking GPU availability for ${gpuType}:`, error);
    return {
      available: false,
      gpuType,
      message: error.message || 'Request failed',
      error: 'request_failed',
      details: { 
        size: gpuConfig.size, 
        image: gpuConfig.image 
      }
    };
  }
}

/**
 * Checks availability for all GPU types
 * @returns {Promise<Object>} - Map of GPU types to availability status
 */
async function checkAllGpuAvailability() {
  const results = {};
  const gpuTypes = Object.keys(GPU_TYPES);
  
  for (const gpuType of gpuTypes) {
    try {
      results[gpuType] = await checkGpuAvailability(gpuType);
    } catch (error) {
      console.error(`Error checking ${gpuType}:`, error);
      results[gpuType] = {
        available: false,
        gpuType,
        message: error.message,
        error: 'check_failed'
      };
    }
    
    // Add a small delay between checks to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

module.exports = {
  checkGpuAvailability,
  checkAllGpuAvailability
};

// backend/src/services/notification.js
const webpush = require('web-push');
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = require('../config');

// Set up VAPID keys for web push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// In-memory store for subscriptions (would use a database in production)
const subscriptions = new Map();

/**
 * Add a new push notification subscription
 * @param {string} userId - Unique identifier for the user
 * @param {Object} subscription - Push subscription object
 * @param {Array<string>} gpuTypes - Array of GPU types to monitor
 */
function addSubscription(userId, subscription, gpuTypes) {
  subscriptions.set(userId, {
    subscription,
    gpuTypes: gpuTypes || Object.keys(require('../config').GPU_TYPES),
    lastNotified: {}
  });
  return getSubscriptionInfo(userId);
}

/**
 * Get subscription info for a user
 * @param {string} userId - User ID
 * @returns {Object|null} - Subscription info or null if not found
 */
function getSubscriptionInfo(userId) {
  const sub = subscriptions.get(userId);
  if (!sub) return null;
  
  return {
    userId,
    gpuTypes: sub.gpuTypes,
    lastNotified: sub.lastNotified
  };
}

/**
 * Update GPU types for a subscription
 * @param {string} userId - User ID
 * @param {Array<string>} gpuTypes - GPU types to monitor
 */
function updateSubscriptionGpuTypes(userId, gpuTypes) {
  const sub = subscriptions.get(userId);
  if (!sub) return null;
  
  sub.gpuTypes = gpuTypes;
  subscriptions.set(userId, sub);
  
  return getSubscriptionInfo(userId);
}

/**
 * Remove a subscription
 * @param {string} userId - User ID
 */
function removeSubscription(userId) {
  return subscriptions.delete(userId);
}

/**
 * Get all subscriptions
 * @returns {Array} - Array of all subscription objects
 */
function getAllSubscriptions() {
  return Array.from(subscriptions.entries()).map(([userId, data]) => ({
    userId,
    subscription: data.subscription,
    gpuTypes: data.gpuTypes,
    lastNotified: data.lastNotified
  }));
}

/**
 * Send push notification for available GPU
 * @param {Object} subscription - Push subscription object
 * @param {Object} gpuInfo - GPU availability info
 */
async function sendNotification(subscription, gpuInfo) {
  try {
    const payload = JSON.stringify({
      title: 'GPU Available!',
      body: `${gpuInfo.gpuType} is now available on DigitalOcean`,
      data: {
        url: 'https://cloud.digitalocean.com/droplets/new',
        gpuInfo
      }
    });

    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    if (error.statusCode === 410) {
      // Subscription has expired or is invalid
      return { error: 'subscription_expired' };
    }
    return { error: error.message };
  }
}

/**
 * Notify subscribers about available GPUs
 * @param {Object} availabilityResults - Results from GPU availability check
 */
async function notifySubscribers(availabilityResults) {
  const notificationPromises = [];
  const currentTime = Date.now();
  
  // Minimum time between notifications for the same GPU type (1 hour)
  const NOTIFICATION_COOLDOWN = 60 * 60 * 1000;

  for (const [userId, data] of subscriptions.entries()) {
    const { subscription, gpuTypes, lastNotified } = data;
    
    // Check each GPU type the user is interested in
    for (const gpuType of gpuTypes) {
      const result = availabilityResults[gpuType];
      
      // Skip if not available or already notified recently
      if (!result || !result.available) continue;
      if (lastNotified[gpuType] && 
          (currentTime - lastNotified[gpuType]) < NOTIFICATION_COOLDOWN) {
        continue;
      }
      
      // Send notification and update last notified time
      notificationPromises.push(
        sendNotification(subscription, result)
          .then(success => {
            if (success) {
              const subData = subscriptions.get(userId);
              if (subData) {
                subData.lastNotified[gpuType] = currentTime;
                subscriptions.set(userId, subData);
              }
            }
            return { userId, gpuType, success };
          })
      );
    }
  }
  
  return Promise.all(notificationPromises);
}

module.exports = {
  getPublicVapidKey: () => VAPID_PUBLIC_KEY,
  addSubscription,
  getSubscriptionInfo,
  updateSubscriptionGpuTypes,
  removeSubscription,
  getAllSubscriptions,
  sendNotification,
  notifySubscribers
};

// backend/src/utils/scheduler.js
const { CHECK_INTERVAL } = require('../config');
const digitalOceanService = require('../services/digitalocean');
const notificationService = require('../services/notification');

// Status storage with initial values
const statusStore = {
  lastCheck: null,
  results: {},
  isChecking: false,
  error: null
};

let checkInterval = null;

/**
 * Check GPU availability and notify subscribers
 */
async function checkAvailability() {
  if (statusStore.isChecking) {
    return;
  }
  
  statusStore.isChecking = true;
  
  try {
    const results = await digitalOceanService.checkAllGpuAvailability();
    
    // Store results
    statusStore.lastCheck = new Date();
    statusStore.results = results;
    statusStore.error = null;
    
    // Check for available GPUs and notify subscribers
    const availableGpus = Object.entries(results)
      .filter(([_, result]) => result.available)
      .map(([gpuType, _]) => gpuType);
    
    if (availableGpus.length > 0) {
      console.log(`GPUs available: ${availableGpus.join(', ')}`);
      await notificationService.notifySubscribers(results);
    }
  } catch (error) {
    console.error('Error in availability check:', error);
    statusStore.error = error.message;
  } finally {
    statusStore.isChecking = false;
  }
}

/**
 * Start the checking scheduler
 */
function startChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Run an initial check
  checkAvailability();
  
  // Set up regular interval
  checkInterval = setInterval(checkAvailability, CHECK_INTERVAL);
  console.log(`Scheduler started, checking every ${CHECK_INTERVAL / 1000} seconds`);
}

/**
 * Stop the checking scheduler
 */
function stopChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('Scheduler stopped');
  }
}

/**
 * Get current status
 */
function getStatus() {
  return {
    ...statusStore,
    nextCheckAt: statusStore.lastCheck 
      ? new Date(statusStore.lastCheck.getTime() + CHECK_INTERVAL) 
      : null
  };
}

module.exports = {
  startChecking,
  stopChecking,
  getStatus,
  checkAvailability // Exported for manual triggering
};

// backend/src/routes/subscription.js
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

// backend/src/routes/status.js
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

// backend/package.json
{
  "name": "do-gpu-notifier-backend",
  "version": "1.0.0",
  "description": "DigitalOcean GPU Availability Notifier Backend",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "web-push": "^3.6.6"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

// backend/.env (example)
PORT=3001
DO_API_TOKEN=your_digitalocean_api_token
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
# Comma-separated list of regions to check, leave empty to check all regions
REGIONS_TO_CHECK=nyc1,sfo3,fra1
