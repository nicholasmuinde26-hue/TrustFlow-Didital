import http from 'node:http';
import app from './giving.app.js';
import env from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializePaymentProviders } from './payment/providers/provider.bootstrap.js';
import mongoose from 'mongoose';

async function start() {
  await connectDatabase();
  initializePaymentProviders();

  const server = http.createServer(app);
  server.listen(env.givingPort, () => {
    console.log(`Giving API listening on :${env.givingPort} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down Giving API`);
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Giving API failed to start:', error);
  process.exit(1);
});
