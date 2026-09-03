const dns = require('dns');
const mongoose = require('mongoose');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const Setting = require('../models/Setting');

const DEFAULT_QUIZZES = require('../../js/data/defaultQuizzes');
const { DEFAULT_USERS, DEFAULT_ATTEMPTS } = require('../../js/data/defaultUsers');

// Configure reliable DNS servers (Google DNS & Cloudflare) to prevent SRV lookup failures on Windows/ISPs
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Silent fallback if custom resolver is not permitted
}

let isConnected = false;

/**
 * Connect to MongoDB Atlas
 * @param {string} uri - MongoDB connection string URI
 */
async function connectMongoDB(uri) {
  let mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.trim()) {
    console.log('ℹ️ [Database] No MONGODB_URI found in environment. Running in local storage mode.');
    return false;
  }

  // Format URI to ensure database name is specified
  if (mongoUri.includes('mongodb+srv://') && !mongoUri.includes('.mongodb.net/')) {
    mongoUri = mongoUri.replace('.mongodb.net?', '.mongodb.net/quizzmaster?');
  } else if (mongoUri.includes('.mongodb.net/?')) {
    mongoUri = mongoUri.replace('.mongodb.net/?', '.mongodb.net/quizzmaster?');
  }

  try {
    console.log('⏳ [Database] Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true
    });

    isConnected = true;
    console.log(`✅ [Database] MongoDB Atlas connected successfully! (${conn.connection.host}/${conn.connection.name})`);

    // Auto-seed default data if database is brand new / empty
    await seedMongoDefaults();
    return true;
  } catch (err) {
    console.error('❌ [Database] MongoDB Atlas connection failed:', err.message);
    console.log('⚠️ [Database] Falling back to local storage mode.');
    isConnected = false;
    return false;
  }
}

/**
 * Seed initial quizzes, accounts, and sample attempts into MongoDB Atlas
 */
async function seedMongoDefaults() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 [Database] Seeding default users to MongoDB Atlas...');
      await User.insertMany(DEFAULT_USERS);
      console.log(`✅ [Database] Seeded ${DEFAULT_USERS.length} default user accounts.`);
    }

    const quizCount = await Quiz.countDocuments();
    if (quizCount === 0) {
      console.log('🌱 [Database] Seeding default quizzes to MongoDB Atlas...');
      const quizzesToSeed = DEFAULT_QUIZZES.map(q => ({
        ...q,
        testCode: q.testCode || ("TEST-" + (q.id ? q.id.slice(-4).toUpperCase() : Math.floor(100 + Math.random() * 900))),
        password: q.password || ""
      }));
      await Quiz.insertMany(quizzesToSeed);
      console.log(`✅ [Database] Seeded ${quizzesToSeed.length} default quizzes.`);
    }

    const attemptCount = await Attempt.countDocuments();
    if (attemptCount === 0 && DEFAULT_ATTEMPTS && DEFAULT_ATTEMPTS.length > 0) {
      console.log('🌱 [Database] Seeding sample student attempts to MongoDB Atlas...');
      await Attempt.insertMany(DEFAULT_ATTEMPTS);
      console.log(`✅ [Database] Seeded ${DEFAULT_ATTEMPTS.length} sample attempt records.`);
    }
  } catch (seedErr) {
    console.error('⚠️ [Database] Error seeding defaults to MongoDB:', seedErr.message);
  }
}

function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectMongoDB,
  seedMongoDefaults,
  isMongoConnected,
  models: {
    User,
    Quiz,
    Attempt,
    Setting
  }
};
