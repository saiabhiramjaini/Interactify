import mongoose from 'mongoose';
import { config } from '../config';

// Throws on failure so startup aborts instead of running without a database.
const connectDB = async (uri: string = config.mongoUri) => {
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }
  await mongoose.connect(uri);
  console.log('MongoDB Connected');
};

export default connectDB;
