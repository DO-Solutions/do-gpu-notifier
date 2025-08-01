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
  
  console.log(`Checking DO API for GPU availability: ${gpuType} (size: ${gpuConfig.size})`);
  
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
  
  console.log(`Starting DO API check for all GPU types: ${gpuTypes.join(', ')}`);
  
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

