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

