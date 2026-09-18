const http = require('http');

const { createApp } = require('./app');
const { env } = require('./utils/env');
const { ensureRolesSeeded } = require('./utils/seed');
const { connectToMongoWithRetry, mongoState } = require('./utils/mongo');

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  // Connect to Mongo in the background (do not crash server if Mongo isn't up yet).
  connectToMongoWithRetry(env.MONGO_URI, { retryDelayMs: 5000 });

  // Seed roles once the DB is connected.
  const seedInterval = setInterval(async () => {
    if (!mongoState.connected) return;
    clearInterval(seedInterval);
    try {
      await ensureRolesSeeded();
      // eslint-disable-next-line no-console
      console.log('Roles ensured');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Role seeding failed:', err?.message || err);
    }
  }, 1000);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exitCode = 1;
});

