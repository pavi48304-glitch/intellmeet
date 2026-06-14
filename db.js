import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/intellmeet';
  
  try {
    mongoose.set('strictQuery', false);
    console.log('Connecting to MongoDB at:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    
    console.log('======================================================');
    console.log('🟢 MongoDB Connected Successfully 🟢');
    console.log('======================================================');
  } catch (error) {
    console.log('⚠️ Local MongoDB Connection Failed. Falling back to Memory Server...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const memUri = mongoServer.getUri();
      await mongoose.connect(memUri);
      console.log('======================================================');
      console.log('🟢 MongoDB Memory Server Connected Successfully 🟢');
      console.log('======================================================');
    } catch (fallbackErr) {
      console.error('======================================================');
      console.error('⚠️  Memory Server Connection Failed: ', fallbackErr.message);
      console.error('FATAL: Application requires MongoDB to run. Exiting.');
      console.error('======================================================');
      process.exit(1);
    }
  }
};
