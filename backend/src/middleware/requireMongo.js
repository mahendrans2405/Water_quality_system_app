const { mongoState } = require('../utils/mongo');

function requireMongo(req, res, next) {
  if (mongoState.connected) return next();
  return res.status(503).json({
    ok: false,
    error: {
      code: 'DB_UNAVAILABLE',
      message: 'Database is not connected. Start MongoDB and retry.',
    },
  });
}

module.exports = { requireMongo };

