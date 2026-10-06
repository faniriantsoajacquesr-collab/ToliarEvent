const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./Routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Signature verification requires the exact bytes, before express.json().
app.post('/api/payments/papi/notification', express.raw({ type: 'application/json', limit: '64kb' }), require('./Controllers/papiController').notification);
// Increase payload limit to allow data URLs for design images (e.g. up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start server
app.listen(PORT, () => {
  require('./workers/reconcilePapi').startPapiReconciliation();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Auth endpoints available at http://localhost:${PORT}/api/auth`);
});
