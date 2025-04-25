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

