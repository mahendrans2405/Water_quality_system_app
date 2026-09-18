const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { env } = require('../src/utils/env');
const { connectToMongo } = require('../src/utils/mongo');
const { ensureRolesSeeded } = require('../src/utils/seed');

let appInstance = null;
let seedDone = false;

module.exports = async (req, res) => {
  // Reuse existing Mongoose connection across serverless invocations
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectToMongo(env.MONGO_URI);
      if (!seedDone) {
        await ensureRolesSeeded();
        seedDone = true;
      }
    } catch (err) {
      console.error('Database connection error in serverless handler:', err);
    }
  }

  if (!appInstance) {
    appInstance = createApp();
  }

  return appInstance(req, res);
};
