require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  DO_API_TOKEN: process.env.DO_API_TOKEN,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  CHECK_INTERVAL: 100000, // 100 seconds
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

