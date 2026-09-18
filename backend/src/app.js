const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { env } = require('./utils/env');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const { errorHandler } = require('./middleware/errorHandler');
const { apiRouter } = require('./routes');
const { mongoState } = require('./utils/mongo');
const { requireMongo } = require('./middleware/requireMongo');

function createApp() {
  const app = express();

  app.use(helmet());
  const allowlist = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : null;
  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser clients (React Native) with no Origin header
        if (!origin) return cb(null, true);
        if (!allowlist) return cb(null, true);
        return cb(null, allowlist.includes(origin));
      },
      credentials: false,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/', (req, res) => {
    res.json({
      ok: true,
      message: 'Water Quality API. See /health and /api/*',
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'water-quality-api',
      mongo: {
        connected: mongoState.connected,
        lastError: mongoState.lastError ? String(mongoState.lastError.message || mongoState.lastError) : null,
      },
    });
  });

  app.use('/api', requireMongo, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

