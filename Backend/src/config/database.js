import mongoose from 'mongoose';
import env from './env.js';

export const connectDatabase = async () => {
  try {
    if (!env.mongoUri) {
      throw new Error('MONGO_URI is not defined');
    }

    await mongoose.connect(env.mongoUri);

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed');
    console.error(error.message);

    process.exit(1);
  }
};