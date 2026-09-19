const mongoose = require('mongoose');
const { mongoState, connectToMongo } = require('../utils/mongo');
const { env } = require('../utils/env');

async function requireMongo(req, res, next) {
  if (mongoState.connected && mongoose.connection.readyState === 1) {
    return next();
  }

  // Attempt on-demand connection for serverless environments (Vercel)
  if (env.MONGO_URI) {
    try {
      await connectToMongo(env.MONGO_URI);
      mongoState.connected = true;
      return next();
    } catch (err) {
      mongoState.connected = false;
      mongoState.lastError = err;
      return res.status(503).json({
        ok: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database connection failed: ' + (err?.message || err),
        },
      });
    }
  }

  return res.status(503).json({
    ok: false,
    error: {
      code: 'DB_UNAVAILABLE',
      message: 'Database is not connected. Start MongoDB and retry.',
    },
  });
}

module.exports = { requireMongo };

