const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const questionRoutes = require('./routes/questions');
const attemptRoutes = require('./routes/attempts');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request Logger (Development friendly)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

const { isMongoConnected } = require('./database/mongoose');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: isMongoConnected() ? 'MongoDB Atlas (Connected)' : 'Local Storage Mode',
    timestamp: new Date().toISOString(),
    service: 'QuizzMaster Pro REST API',
    version: '1.0.0'
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/quizzes/:quizId/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend files from project root
const ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR, { index: 'index.html' }));

// SPA fallback to index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API endpoint ${req.method} ${req.path} not found.` });
  }
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Start listening if not imported as a module
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 QuizzMaster Pro Backend Server is running!`);
    console.log(`📡 Access Application: http://localhost:${PORT}`);
    console.log(`🔌 REST API Base URL:  http://localhost:${PORT}/api`);
    console.log(`====================================================`);
  });
}

module.exports = app;
