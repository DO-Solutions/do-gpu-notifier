const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Register the service worker for push notifications
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported in this browser');
  }
  
  return navigator.serviceWorker.register('/service-worker.js');
}

/**
 * Get the VAPID public key from the server
 * @returns {Promise<String>} - VAPID public key
 */
async function getVapidPublicKey() {
  const response = await fetch(`${API_BASE_URL}/subscription/vapid-public-key`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  const data = await response.json();
  return data.key;
}

/**
 * Subscribe to push notifications
 * @param {String} userId - Unique identifier for the user
 * @param {Array<String>} gpuTypes - Array of GPU type IDs to monitor
 * @returns {Promise<Object>} - Subscription info
 */
export async function subscribeToNotifications(userId, gpuTypes) {
  // Register service worker if not already registered
  const registration = await registerServiceWorker();
  
  // Get existing subscription or create a new one
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    // Get VAPID public key from server
    const vapidPublicKey = await getVapidPublicKey();
    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
    
    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });
  }
  
  // Send subscription to server
  const response = await fetch(`${API_BASE_URL}/subscription/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      subscription,
      gpuTypes
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

/**
 * Update the GPU types for an existing subscription
 * @param {String} userId - User ID
 * @param {Array<String>} gpuTypes - GPU types to monitor
 * @returns {Promise<Object>} - Updated subscription info
 */
export async function updateSubscribedGpuTypes(userId, gpuTypes) {
  const response = await fetch(`${API_BASE_URL}/subscription/${userId}/gpu-types`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gpuTypes
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

/**
 * Unsubscribe from push notifications
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} - Success status
 */
export async function unsubscribeFromNotifications(userId) {
  // Unsubscribe from push manager
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
  }
  
  // Delete subscription from server
  const response = await fetch(`${API_BASE_URL}/subscription/${userId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return true;
}

/**
 * Convert base64 string to Uint8Array
 * (Required for applicationServerKey)
 * @param {String} base64String - Base64 encoded string
 * @returns {Uint8Array} - Converted array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

