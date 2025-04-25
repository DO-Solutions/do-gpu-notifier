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

