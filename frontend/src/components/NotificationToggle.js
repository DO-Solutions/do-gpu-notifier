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

