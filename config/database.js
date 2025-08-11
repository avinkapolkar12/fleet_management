const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // MongoDB connection string - you can customize this
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleet_management';
        
        const conn = await mongoose.connect(MONGODB_URI, {
            // Remove deprecated options
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Log database name
        console.log(`Database: ${conn.connection.name}`);
        
        return conn;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        
        // For development, fall back to in-memory or create a local DB
        if (process.env.NODE_ENV !== 'production') {
            console.log('Attempting to connect to local MongoDB...');
            try {
                const fallbackConn = await mongoose.connect('mongodb://127.0.0.1:27017/fleet_management_local');
                console.log(`MongoDB Connected (Fallback): ${fallbackConn.connection.host}`);
                return fallbackConn;
            } catch (fallbackError) {
                console.error('Fallback MongoDB connection also failed:', fallbackError);
                console.log('\n⚠️  MongoDB Setup Required:');
                console.log('1. Install MongoDB: https://www.mongodb.com/try/download/community');
                console.log('2. Start MongoDB service');
                console.log('3. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
                console.log('4. Set MONGODB_URI environment variable if using custom connection\n');
                process.exit(1);
            }
        } else {
            process.exit(1);
        }
    }
};

const closeDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
};

module.exports = { connectDB, closeDB };
