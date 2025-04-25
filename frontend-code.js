// frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// frontend/src/index.css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f7f9;
  color: #333;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.button {
  background-color: #0069ff;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #0050e6;
}

.button:disabled {
  background-color: #c9d1d9;
  cursor: not-allowed;
}

.button-secondary {
  background-color: #f5f7f9;
  color: #333;
  border: 1px solid #c9d1d9;
}

.button-secondary:hover {
  background-color: #eaeef2;
}

.text-danger {
  color: #d73a49;
}

.text-success {
  color: #28a745;
}

.checkbox-list {
  list-style: none;
  padding: 0;
}

.checkbox-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.checkbox-item input[type="checkbox"] {
  margin-right: 10px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.available {
  background-color: #d4f7e7;
  color: #13795b;
}

.status-badge.unavailable {
  background-color: #ffe5e5;
  color: #cc0000;
}

.status-badge.unknown {
  background-color: #f4f4f4;
  color: #666;
}

// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import GpuSelector from './components/GpuSelector';
import NotificationToggle from './components/NotificationToggle';
import StatusPanel from './components/StatusPanel';
import { subscribeToNotifications, unsubscribeFromNotifications, updateSubscribedGpuTypes } from './services/notification';
import { fetchGpuTypes, fetchAvailabilityStatus, triggerCheck } from './services/api';

function App() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [gpuTypes, setGpuTypes] = useState([]);
  const [selectedGpuTypes, setSelectedGpuTypes] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [checkingNow, setCheckingNow] = useState(false);
  const [error, setError] = useState(null);

  // Initialize user ID on first load
  useEffect(() => {
    // Generate a unique ID for this browser or get existing one
    const storedUserId = localStorage.getItem('doGpuNotifierUserId');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('doGpuNotifierUserId', newUserId);
      setUserId(newUserId);
    }
  }, []);

  // Load GPU types and check subscription status
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch available GPU types
        const types = await fetchGpuTypes();
        setGpuTypes(types);
        
        // Set default selected types (all)
        setSelectedGpuTypes(types.map(t => t.id));
        
        // Check if notifications are already enabled in this browser
        const subscription = await navigator.serviceWorker.ready.then(
          registration => registration.pushManager.getSubscription()
        );
        setNotificationsEnabled(!!subscription);
        
        // Fetch current availability status
        const status = await fetchAvailabilityStatus();
        setAvailabilityStatus(status);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load initial data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
    
    // Set up polling for availability status updates
    const statusInterval = setInterval(async () => {
      try {
        const status = await fetchAvailabilityStatus();
        setAvailabilityStatus(status);
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 15000); // Poll every 15 seconds
    
    return () => clearInterval(statusInterval);
  }, []);

  // Handle notification toggle
  const handleNotificationToggle = async (enabled) => {
    try {
      if (enabled) {
        await subscribeToNotifications(userId, selectedGpuTypes);
        setNotificationsEnabled(true);
      } else {
        await unsubscribeFromNotifications(userId);
        setNotificationsEnabled(false);
      }
    } catch (err) {
      console.error('Error toggling notifications:', err);
      setError(err.message || 'Failed to update notification settings');
    }
  };

  // Handle GPU type selection change
  const handleGpuSelectionChange = async (gpuTypeId, selected) => {
    const newSelection = selected
      ? [...selectedGpuTypes, gpuTypeId]
      : selectedGpuTypes.filter(id => id !== gpuTypeId);
    
    setSelectedGpuTypes(newSelection);
    
    // Update subscription if notifications are enabled
    if (notificationsEnabled) {
      try {
        await updateSubscribedGpuTypes(userId, newSelection);
      } catch (err) {
        console.error('Error updating GPU selection:', err);
        setError('Failed to update GPU selection');
      }
    }
  };

  // Handle manual check
  const handleCheckNow = async () => {
    try {
      setCheckingNow(true);
      setError(null);
      const status = await triggerCheck();
      setAvailabilityStatus(status);
    } catch (err) {
      console.error('Error triggering check:', err);
      setError('Failed to check availability');
    } finally {
      setCheckingNow(false);
    }
  };

  if (loading) {
    return <div className="container"><div className="card">Loading...</div></div>;
  }

  return (
    <div className="container">
      <div className="header">
        <h1>DO GPU Notifier</h1>
      </div>
      
      {error && (
        <div className="card">
          <p className="text-danger">{error}</p>
        </div>
      )}
      
      <div className="card">
        <h2>Notification Settings</h2>
        <NotificationToggle 
          enabled={notificationsEnabled} 
          onToggle={handleNotificationToggle} 
        />
        
        <h3>GPU Types to Monitor</h3>
        <GpuSelector 
          gpuTypes={gpuTypes} 
          selectedGpuTypes={selectedGpuTypes}
          onChange={handleGpuSelectionChange}
          disabled={!notificationsEnabled}
        />
      </div>
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Current Availability</h2>
          <button 
            className="button" 
            onClick={handleCheckNow} 
            disabled={checkingNow}
          >
            {checkingNow ? 'Checking...' : 'Check Now'}
          </button>
        </div>
        <StatusPanel 
          availabilityStatus={availabilityStatus} 
          gpuTypes={gpuTypes}
        />
      </div>
    </div>
  );
}

export default App;

// frontend/src/components/GpuSelector.js
import React from 'react';

function GpuSelector({ gpuTypes, selectedGpuTypes, onChange, disabled }) {
  return (
    <ul className="checkbox-list">
      {gpuTypes.map((gpuType) => (
        <li key={gpuType.id} className="checkbox-item">
          <input
            type="checkbox"
            id={`gpu-${gpuType.id}`}
            checked={selectedGpuTypes.includes(gpuType.id)}
            onChange={(e) => onChange(gpuType.id, e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor={`gpu-${gpuType.id}`}>
            {gpuType.name} ({gpuType.size})
          </label>
        </li>
      ))}
    </ul>
  );
}

export default GpuSelector;

// frontend/src/components/NotificationToggle.js
import React, { useState } from 'react';

function NotificationToggle({ enabled, onToggle }) {
  const [isTogglingState, setIsTogglingState] = useState(false);
  
  const handleToggleClick = async () => {
    try {
      setIsTogglingState(true);
      
      if (!enabled) {
        // Check if notifications are supported
        if (!('Notification' in window)) {
          throw new Error('This browser does not support desktop notifications');
        }
        
        // Request permission if needed
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            throw new Error('Notification permission denied');
          }
        }
      }
      
      // Toggle notification state
      await onToggle(!enabled);
    } catch (error) {
      console.error('Error toggling notifications:', error);
      alert(`Failed to ${enabled ? 'disable' : 'enable'} notifications: ${error.message}`);
    } finally {
      setIsTogglingState(false);
    }
  };
  
  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        className={`button ${enabled ? 'button-secondary' : ''}`}
        onClick={handleToggleClick}
        disabled={isTogglingState}
      >
        {isTogglingState
          ? 'Processing...'
          : enabled
            ? 'Disable Notifications'
            : 'Enable Notifications'}
      </button>
      
      <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
        {enabled
          ? 'You will receive notifications when GPUs become available.'
          : 'Enable notifications to get alerts when GPUs become available.'}
      </p>
    </div>
  );
}

export default NotificationToggle;

// frontend/src/components/StatusPanel.js
import React, { useState } from 'react';

function StatusPanel({ availabilityStatus, gpuTypes }) {
  const [expandedResult, setExpandedResult] = useState(null);
  
  if (!availabilityStatus) {
    return <p>Loading status information...</p>;
  }
  
  const { lastCheck, results, isChecking, error, nextCheckAt } = availabilityStatus;
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const getGpuName = (gpuTypeId) => {
    const gpuType = gpuTypes.find(t => t.id === gpuTypeId);
    return gpuType ? gpuType.name : gpuTypeId;
  };
  
  const getStatusBadge = (result) => {
    if (!result) {
      return <span className="status-badge unknown">Unknown</span>;
    }
    
    if (result.available) {
      return <span className="status-badge available">Available</span>;
    }
    
    return <span className="status-badge unavailable">Unavailable</span>;
  };
  
  const toggleExpandResult = (gpuTypeId) => {
    if (expandedResult === gpuTypeId) {
      setExpandedResult(null);
    } else {
      setExpandedResult(gpuTypeId);
    }
  };
  
  const renderRegionDetails = (result) => {
    if (!result?.details?.regions || !Array.isArray(result.details.regions)) {
      return null;
    }
    
    return (
      <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Region Details</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee' }}>Region</th>
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee' }}>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {result.details.regions.map((region, index) => (
              <tr key={index}>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                  {region.region}
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                  <span className={`status-badge ${getCapacityClass(region.capacity)}`}>
                    {region.capacity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  const getCapacityClass = (capacity) => {
    if (!capacity) return 'unknown';
    
    switch (capacity.toUpperCase()) {
      case 'HIGH':
        return 'available';
      case 'MEDIUM':
        return 'available';
      case 'LOW':
        return 'unavailable';
      case 'NONE':
        return 'unavailable';
      default:
        return 'unknown';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <p><strong>Last check:</strong> {formatDateTime(lastCheck)}</p>
        <p><strong>Next check:</strong> {formatDateTime(nextCheckAt)}</p>
        {isChecking && <p><em>Currently checking...</em></p>}
        {error && <p className="text-danger">Error: {error}</p>}
      </div>
      
      <h3>GPU Status</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>GPU Type</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Message</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(results).map(([gpuTypeId, result]) => (
            <React.Fragment key={gpuTypeId}>
              <tr>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {getGpuName(gpuTypeId)}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {getStatusBadge(result)}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {result?.message || 'No information available'}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {result?.details?.regions && (
                    <button
                      className="button button-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.8em' }}
                      onClick={() => toggleExpandResult(gpuTypeId)}
                    >
                      {expandedResult === gpuTypeId ? 'Hide Details' : 'Show Regions'}
                    </button>
                  )}
                </td>
              </tr>
              {expandedResult === gpuTypeId && (
                <tr>
                  <td colSpan="4" style={{ padding: '0 8px 16px 8px', backgroundColor: '#f9f9f9' }}>
                    {renderRegionDetails(result)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StatusPanel;

// frontend/src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Fetch available GPU types
 * @returns {Promise<Array>} - Array of GPU type objects
 */
export async function fetchGpuTypes() {
  const response = await fetch(`${API_BASE_URL}/status/gpu-types`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch current availability status
 * @returns {Promise<Object>} - Current availability status
 */
export async function fetchAvailabilityStatus() {
  const response = await fetch(`${API_BASE_URL}/status/availability`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

/**
 * Trigger an immediate availability check
 * @returns {Promise<Object>} - Updated availability status
 */
export async function triggerCheck() {
  const response = await fetch(`${API_BASE_URL}/status/check-now`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

// frontend/src/services/notification.js
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

// frontend/public/service-worker.js
// This service worker handles push notifications

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }
  
  const data = event.data.json();
  
  const title = data.title || 'GPU Availability Update';
  const options = {
    body: data.body || 'A GPU is now available on DigitalOcean!',
    icon: '/logo192.png',
    badge: '/badge.png',
    data: data.data
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Open the DigitalOcean droplet creation page or custom URL if provided
  const urlToOpen = event.notification.data?.url || 'https://cloud.digitalocean.com/droplets/new';
  
  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});

// frontend/public/manifest.json
{
  "short_name": "DO GPU Notifier",
  "name": "DigitalOcean GPU Availability Notifier",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#0069ff",
  "background_color": "#f5f7f9"
}

// frontend/package.json
{
  "name": "do-gpu-notifier-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
