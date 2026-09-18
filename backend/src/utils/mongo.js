const mongoose = require('mongoose');

const mongoState = {
  connected: false,
  lastError: null,
};

function setupMongoListeners() {
  if (mongoState._listenersInstalled) return;
  mongoState._listenersInstalled = true;

  mongoose.connection.on('connected', () => {
    mongoState.connected = true;
    mongoState.lastError = null;
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    mongoState.connected = false;
    // eslint-disable-next-line no-console
    console.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    mongoState.connected = false;
    mongoState.lastError = err;
    // eslint-disable-next-line no-console
    console.warn('MongoDB error:', err?.message || err);
  });
}

async function cleanupLegacyCompanyIndex() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection('companies');
    const indexes = await collection.listIndexes().toArray();
    const hasLegacyEmailIndex = indexes.some((idx) => idx.name === 'email_1');

    if (hasLegacyEmailIndex) {
      await collection.dropIndex('email_1');
      // eslint-disable-next-line no-console
      console.log('Removed legacy companies.email_1 index');
    }

    const nullEmailCount = await collection.countDocuments({ email: null });
    if (nullEmailCount > 0) {
      await collection.updateMany({ email: null }, { $unset: { email: '' } });
      // eslint-disable-next-line no-console
      console.log('Removed legacy null email values from companies');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Legacy company index cleanup skipped:', err?.message || err);
  }
}

async function connectToMongo(mongoUri) {
  setupMongoListeners();
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    tlsAllowInvalidCertificates: true,
  });
  await cleanupLegacyCompanyIndex();
}

function connectToMongoWithRetry(mongoUri, { retryDelayMs = 5000 } = {}) {
  let stopped = false;

  async function attempt() {
    if (stopped) return;
    try {
      await connectToMongo(mongoUri);
    } catch (err) {
      mongoState.connected = false;
      mongoState.lastError = err;
      // eslint-disable-next-line no-console
      console.warn(`MongoDB connection failed. Retrying in ${retryDelayMs}ms...`, err?.message || err);
      setTimeout(attempt, retryDelayMs);
    }
  }

  attempt();

  return {
    stop: () => {
      stopped = true;
    },
  };
}

module.exports = { connectToMongo, connectToMongoWithRetry, mongoState };

