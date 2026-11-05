import http from 'http';
import mongoose from 'mongoose';

import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startOrderExpiryJob } from './jobs/orderExpiry.job.js';
const server = http.createServer(app);

async function startServer() {
  try {
    // Connect to MongoDB first
    await connectDB();
startOrderExpiryJob();
    // Start Express server
    server.listen(env.port, () => {
      console.log(
        `Hyni backend running at http://localhost:${env.port}`
      );

      console.log(
        `Health check: http://localhost:${env.port}/api/health`
      );
    });

  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();