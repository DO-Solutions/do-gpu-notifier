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

