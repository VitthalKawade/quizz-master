const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULT_QUIZZES = require('../../js/data/defaultQuizzes');
const { DEFAULT_USERS, DEFAULT_ATTEMPTS } = require('../../js/data/defaultUsers');
const { connectMongoDB, isMongoConnected, models } = require('./mongoose');

class Database {
  constructor() {
    this.data = {
      users: [],
      quizzes: [],
      attempts: [],
      settings: {
        theme: "dark",
        sound: true
      }
    };
    this.init();
  }

  async init() {
    // 1. Ensure local data directory & file exist as cache/fallback
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error("Error reading database file, initializing defaults:", err);
        this.seedDefaults();
      }
    } else {
      this.seedDefaults();
    }

    // 2. Connect to MongoDB Atlas if MONGODB_URI is provided
    if (process.env.MONGODB_URI) {
      const connected = await connectMongoDB(process.env.MONGODB_URI);
      if (connected) {
        await this.syncFromMongo();
      }
    }
  }

  async syncFromMongo() {
    try {
      if (!isMongoConnected()) return;

      const mongoUsers = await models.User.find().lean();
      const mongoQuizzes = await models.Quiz.find().lean();
      const mongoAttempts = await models.Attempt.find().lean();

      if (mongoUsers.length > 0) {
        this.data.users = mongoUsers.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          avatar: u.avatar || '🎓',
          isGoogleAuth: u.isGoogleAuth || false,
          createdAt: u.createdAt
        }));
      }

      if (mongoQuizzes.length > 0) {
        this.data.quizzes = mongoQuizzes.map(q => ({
          id: q.id,
          title: q.title,
          category: q.category,
          testCode: q.testCode,
          password: q.password || '',
          icon: q.icon || '📝',
          difficulty: q.difficulty || 'Medium',
          durationMinutes: q.durationMinutes || 15,
          passPercentage: q.passPercentage || 60,
          totalMarks: q.totalMarks || 20,
          description: q.description || '',
          questions: q.questions || [],
          createdAt: q.createdAt
        }));
      }

      if (mongoAttempts.length > 0) {
        this.data.attempts = mongoAttempts.map(a => ({
          id: a.id,
          userId: a.userId,
          userName: a.userName,
          userEmail: a.userEmail,
          userAvatar: a.userAvatar,
          quizId: a.quizId,
          quizTitle: a.quizTitle,
          category: a.category,
          testCode: a.testCode,
          difficulty: a.difficulty,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage: a.percentage,
          passed: a.passed,
          passPercentage: a.passPercentage,
          totalQuestions: a.totalQuestions,
          correctCount: a.correctCount,
          wrongCount: a.wrongCount,
          unansweredCount: a.unansweredCount,
          timeSpentSeconds: a.timeSpentSeconds,
          answersBreakdown: a.answersBreakdown || [],
          completedAt: a.completedAt
        }));
      }

      this.save();
      console.log(`🔄 [Database] In-memory cache synced from MongoDB Atlas (${this.data.quizzes.length} Quizzes, ${this.data.users.length} Users).`);
    } catch (err) {
      console.error('⚠️ [Database] Failed to sync from MongoDB Atlas:', err.message);
    }
  }

  seedDefaults() {
    this.data = {
      users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
      quizzes: JSON.parse(JSON.stringify(DEFAULT_QUIZZES)).map(q => ({
        ...q,
        testCode: q.testCode || ("TEST-" + (q.id ? q.id.slice(-4).toUpperCase() : Math.floor(100 + Math.random() * 900))),
        password: q.password || ""
      })),
      attempts: JSON.parse(JSON.stringify(DEFAULT_ATTEMPTS)),
      settings: {
        theme: "dark",
        sound: true
      }
    };
    this.save();
  }

  save() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error("Failed to write to db.json:", err);
    }
  }

  // --- USERS ---
  getUsers() {
    return this.data.users || [];
  }

  getUserById(id) {
    return this.getUsers().find(u => u.id === id) || null;
  }

  getUserByEmail(email) {
    if (!email) return null;
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  createUser(userData) {
    const newUser = {
      id: userData.id || ("user_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      role: userData.role === "admin" ? "admin" : "student",
      avatar: userData.avatar || "🎓",
      isGoogleAuth: userData.isGoogleAuth || false,
      googleId: userData.googleId || undefined,
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.save();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      models.User.findOneAndUpdate({ id: newUser.id }, newUser, { upsert: true, new: true }).catch(err => {
        console.error('MongoDB User sync error:', err.message);
      });
    }

    return newUser;
  }

  updateUser(id, updates) {
    const userIndex = this.data.users.findIndex(u => u.id === id);
    if (userIndex === -1) return null;

    this.data.users[userIndex] = {
      ...this.data.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      models.User.findOneAndUpdate({ id }, updates).catch(err => {
        console.error('MongoDB User update error:', err.message);
      });
    }

    return this.data.users[userIndex];
  }

  // --- QUIZZES ---
  getQuizzes() {
    return this.data.quizzes || [];
  }

  getQuizById(id) {
    return this.getQuizzes().find(q => q.id === id) || null;
  }

  getQuizByCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    return this.getQuizzes().find(q => (q.testCode && q.testCode.toUpperCase() === clean) || q.id.toUpperCase() === clean) || null;
  }

  createQuiz(quizData) {
    const newQuiz = {
      id: quizData.id || ("quiz_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
      title: quizData.title,
      category: quizData.category || "General Knowledge",
      testCode: (quizData.testCode || ("TEST-" + Math.floor(100 + Math.random() * 900))).toUpperCase(),
      password: quizData.password || "",
      icon: quizData.icon || "📝",
      difficulty: quizData.difficulty || "Medium",
      durationMinutes: parseInt(quizData.durationMinutes) || 15,
      passPercentage: parseInt(quizData.passPercentage) || 60,
      totalMarks: parseInt(quizData.totalMarks) || 20,
      description: quizData.description || "",
      questions: quizData.questions || [],
      createdAt: new Date().toISOString()
    };

    this.data.quizzes.unshift(newQuiz);
    this.save();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      models.Quiz.findOneAndUpdate({ id: newQuiz.id }, newQuiz, { upsert: true, new: true }).catch(err => {
        console.error('MongoDB Quiz sync error:', err.message);
      });
    }

    return newQuiz;
  }

  updateQuiz(id, updates) {
    const index = this.data.quizzes.findIndex(q => q.id === id);
    if (index === -1) return null;

    this.data.quizzes[index] = {
      ...this.data.quizzes[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      models.Quiz.findOneAndUpdate({ id }, updates).catch(err => {
        console.error('MongoDB Quiz update error:', err.message);
      });
    }

    return this.data.quizzes[index];
  }

  deleteQuiz(id) {
    const initialLen = this.data.quizzes.length;
    this.data.quizzes = this.data.quizzes.filter(q => q.id !== id);
    if (this.data.quizzes.length !== initialLen) {
      this.save();

      // Async sync to MongoDB Atlas
      if (isMongoConnected()) {
        models.Quiz.deleteOne({ id }).catch(err => {
          console.error('MongoDB Quiz delete error:', err.message);
        });
      }
      return true;
    }
    return false;
  }

  // --- ATTEMPTS ---
  getAttempts(userId = null) {
    const attempts = this.data.attempts || [];
    if (userId) {
      return attempts.filter(a => a.userId === userId);
    }
    return attempts;
  }

  getAttemptById(id) {
    return (this.data.attempts || []).find(a => a.id === id) || null;
  }

  createAttempt(attemptData) {
    const newAttempt = {
      id: attemptData.id || ("att_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
      ...attemptData,
      completedAt: attemptData.completedAt || new Date().toISOString()
    };

    this.data.attempts.unshift(newAttempt);
    this.save();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      models.Attempt.findOneAndUpdate({ id: newAttempt.id }, newAttempt, { upsert: true, new: true }).catch(err => {
        console.error('MongoDB Attempt sync error:', err.message);
      });
    }

    return newAttempt;
  }

  // --- LEADERBOARD COMPUTATION ---
  getLeaderboard(category = "all") {
    const attempts = this.getAttempts();
    const users = this.getUsers().filter(u => u.role === "student");
    const userMap = new Map();

    users.forEach(u => {
      userMap.set(u.id, {
        userId: u.id,
        userName: u.name,
        userAvatar: u.avatar || "🎓",
        totalScore: 0,
        quizzesTaken: 0,
        quizzesPassed: 0,
        totalPercentageSum: 0,
        avgAccuracy: 0
      });
    });

    attempts.forEach(att => {
      if (category !== "all" && att.category !== category) return;

      if (!userMap.has(att.userId)) {
        userMap.set(att.userId, {
          userId: att.userId,
          userName: att.userName || "Scholar",
          userAvatar: att.userAvatar || "🎓",
          totalScore: 0,
          quizzesTaken: 0,
          quizzesPassed: 0,
          totalPercentageSum: 0,
          avgAccuracy: 0
        });
      }

      const record = userMap.get(att.userId);
      record.totalScore += (att.score || 0);
      record.quizzesTaken += 1;
      if (att.passed) record.quizzesPassed += 1;
      record.totalPercentageSum += (att.percentage || 0);
    });

    const leaderboard = Array.from(userMap.values())
      .filter(item => item.quizzesTaken > 0)
      .map(item => ({
        ...item,
        avgAccuracy: Math.round(item.totalPercentageSum / item.quizzesTaken)
      }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
        return b.quizzesPassed - a.quizzesPassed;
      });

    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }

  // --- ADMIN METRICS ---
  getAdminMetrics() {
    const students = this.getUsers().filter(u => u.role === "student");
    const quizzes = this.getQuizzes();
    const attempts = this.getAttempts();

    const avgAccuracy = attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length)
      : 0;

    return {
      totalStudents: students.length,
      totalQuizzes: quizzes.length,
      totalAttempts: attempts.length,
      averageAccuracy: avgAccuracy,
      avgAccuracy: avgAccuracy,
      isMongoDB: isMongoConnected()
    };
  }

  // --- EXPORT / IMPORT / RESET ---
  exportAll() {
    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      databaseEngine: isMongoConnected() ? "MongoDB Atlas" : "Local JSON",
      data: this.data
    };
  }

  async importAll(importedPayload) {
    if (!importedPayload || !importedPayload.data) {
      throw new Error("Invalid backup file format");
    }
    this.data = importedPayload.data;
    this.save();

    if (isMongoConnected()) {
      try {
        await models.User.deleteMany({});
        await models.Quiz.deleteMany({});
        await models.Attempt.deleteMany({});
        if (this.data.users.length > 0) await models.User.insertMany(this.data.users);
        if (this.data.quizzes.length > 0) await models.Quiz.insertMany(this.data.quizzes);
        if (this.data.attempts.length > 0) await models.Attempt.insertMany(this.data.attempts);
      } catch (err) {
        console.error('MongoDB restore sync error:', err.message);
      }
    }
    return true;
  }

  async resetAll() {
    this.seedDefaults();
    if (isMongoConnected()) {
      try {
        await models.User.deleteMany({});
        await models.Quiz.deleteMany({});
        await models.Attempt.deleteMany({});
        await connectMongoDB.seedMongoDefaults?.();
      } catch (err) {
        console.error('MongoDB reset sync error:', err.message);
      }
    }
    return true;
  }
}

const db = new Database();
module.exports = db;
