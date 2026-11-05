import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  const connection = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000
  });

  console.log(
    `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
  );
}

export function getDatabaseState() {
  return mongoose.connection.readyState;
}