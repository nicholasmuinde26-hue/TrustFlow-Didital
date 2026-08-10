import mongoose from 'mongoose';
import env from './env.js';

export const connectDatabase = async () => {
  try {
    if (!env.mongoUri) {
      throw new Error('MONGO_URI is not defined');
    }

    // Explicitly disable retryable writes and reads to support standalone MongoDB deployments
    await mongoose.connect(env.mongoUri, {
      retryWrites: false,
      retryReads: false
    });

    console.log('MongoDB connected successfully');

    // Automatically drop legacy non-sparse indexes causing E11000 duplicate null errors
    try {
      await mongoose.connection.collection('mpesaattempts').dropIndex('mpesa_receipt_number_1');
      console.log('Successfully dropped legacy index: mpesa_receipt_number_1');
    } catch (err) {
      // Index may already be dropped or doesn't exist yet, safe to ignore
    }

    try {
      await mongoose.connection.collection('paymentintents').dropIndex('provider_1_provider_request_id_1');
      console.log('Successfully dropped legacy index: provider_1_provider_request_id_1');
    } catch (err) {
      // Safe to ignore
    }

  } catch (error) {
    console.error('MongoDB connection failed');
    console.error(error.message);

    process.exit(1);
  }
};