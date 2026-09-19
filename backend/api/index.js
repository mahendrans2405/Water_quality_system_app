const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { env } = require('../src/utils/env');
const { connectToMongo, mongoState } = require('../src/utils/mongo');
const { ensureRolesSeeded } = require('../src/utils/seed');

const app = createApp();

let seedAttempted = false;

// Serverless middleware: ensure MongoDB connection is ready before handling requests
app.use(async (req, res, next) => {
  if (!mongoState.connected || mongoose.connection.readyState !== 1) {
    try {
      await connectToMongo(env.MONGO_URI);
      mongoState.connected = true;
      if (!seedAttempted) {
        seedAttempted = true;
        ensureRolesSeeded().catch((err) => console.warn('Role seed warning:', err?.message || err));
      }
    } catch (err) {
      console.error('Mongo serverless connection error:', err?.message || err);
      return res.status(503).json({
        ok: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database connection failed: ' + (err?.message || err) },
      });
    }
  }
  next();
});

module.exports = app;
