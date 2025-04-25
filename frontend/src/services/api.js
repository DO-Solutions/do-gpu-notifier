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

