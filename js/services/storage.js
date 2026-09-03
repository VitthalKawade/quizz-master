/**
 * Storage Service
 * Abstraction layer for localStorage data persistence.
 * Manages quizzes, users, attempt history, and dynamic leaderboard queries.
 */
class StorageService {
  constructor() {
    this.KEYS = {
      QUIZZES: "quizsphere_quizzes_v1",
      USERS: "quizsphere_users_v1",
      ATTEMPTS: "quizsphere_attempts_v1",
      SESSION: "quizsphere_session_v1",
      SETTINGS: "quizsphere_settings_v1"
    };
    this.initialize();
  }

  initialize() {
    // Initialize Quizzes if not present
    if (!localStorage.getItem(this.KEYS.QUIZZES)) {
      const initialQuizzes = (typeof DEFAULT_QUIZZES !== "undefined") ? DEFAULT_QUIZZES : [];
      localStorage.setItem(this.KEYS.QUIZZES, JSON.stringify(initialQuizzes));
    }

    // Initialize Users if not present
    if (!localStorage.getItem(this.KEYS.USERS)) {
      const initialUsers = (typeof DEFAULT_USERS !== "undefined") ? DEFAULT_USERS : [];
      localStorage.setItem(this.KEYS.USERS, JSON.stringify(initialUsers));
    }

    // Initialize Attempts if not present
    if (!localStorage.getItem(this.KEYS.ATTEMPTS)) {
      const initialAttempts = (typeof DEFAULT_ATTEMPTS !== "undefined") ? DEFAULT_ATTEMPTS : [];
      localStorage.setItem(this.KEYS.ATTEMPTS, JSON.stringify(initialAttempts));
    }

    // Initialize Settings (theme, sound)
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({
        theme: "dark",
        sound: true
      }));
    }
  }

  // --- QUIZZES ---
  getQuizzes() {
    try {
      const data = localStorage.getItem(this.KEYS.QUIZZES);
      const quizzes = data ? JSON.parse(data) : [];
      return quizzes.map(q => ({
        ...q,
        testCode: q.testCode || ("TEST-" + (q.id ? q.id.slice(-4).toUpperCase() : Math.floor(100 + Math.random() * 900))),
        password: q.password || ""
      }));
    } catch (e) {
      console.error("Failed to parse quizzes from storage:", e);
      return [];
    }
  }

  getQuizById(id) {
    const quizzes = this.getQuizzes();
    return quizzes.find(q => q.id === id) || null;
  }

  getQuizByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const quizzes = this.getQuizzes();
    return quizzes.find(q => (q.testCode && q.testCode.toUpperCase() === cleanCode) || q.id.toUpperCase() === cleanCode) || null;
  }

  saveQuiz(quizData) {
    const quizzes = this.getQuizzes();
    const existingIndex = quizzes.findIndex(q => q.id === quizData.id);

    if (existingIndex >= 0) {
      quizzes[existingIndex] = { ...quizzes[existingIndex], ...quizData, updatedAt: new Date().toISOString() };
    } else {
      if (!quizData.id) {
        quizData.id = "quiz_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      }
      quizData.createdAt = new Date().toISOString();
      quizzes.unshift(quizData);
    }

    localStorage.setItem(this.KEYS.QUIZZES, JSON.stringify(quizzes));
    return quizData;
  }

  deleteQuiz(id) {
    const quizzes = this.getQuizzes().filter(q => q.id !== id);
    localStorage.setItem(this.KEYS.QUIZZES, JSON.stringify(quizzes));
    return true;
  }

  bulkSaveQuestions(quizId, newQuestions, mode = 'append') {
    const quizzes = this.getQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return null;

    const formatted = newQuestions.map(q => {
      let correctIdx = 0;
      if (typeof q.correctAnswer === 'number') {
        correctIdx = q.correctAnswer;
      } else if (typeof q.correctAnswer === 'string') {
        const upper = q.correctAnswer.trim().toUpperCase();
        if (upper === 'A') correctIdx = 0;
        else if (upper === 'B') correctIdx = 1;
        else if (upper === 'C') correctIdx = 2;
        else if (upper === 'D') correctIdx = 3;
        else {
          const parsed = parseInt(q.correctAnswer, 10);
          correctIdx = isNaN(parsed) ? 0 : parsed;
        }
      }

      return {
        id: q.id || ("q_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
        question: q.question.trim(),
        options: Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [],
        correctAnswer: (correctIdx >= 0 && correctIdx < (q.options ? q.options.length : 4)) ? correctIdx : 0,
        marks: parseInt(q.marks) || 2,
        explanation: (q.explanation || "").trim()
      };
    });

    if (mode === 'replace') {
      quiz.questions = formatted;
    } else {
      if (!quiz.questions) quiz.questions = [];
      quiz.questions.push(...formatted);
    }

    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);
    quiz.updatedAt = new Date().toISOString();

    localStorage.setItem(this.KEYS.QUIZZES, JSON.stringify(quizzes));
    return quiz;
  }

  // --- USERS ---
  getUsers() {
    try {
      const data = localStorage.getItem(this.KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse users from storage:", e);
      return [];
    }
  }

  getUserByEmail(email) {
    if (!email) return null;
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  getUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  saveUser(userData) {
    const users = this.getUsers();
    const existingIndex = users.findIndex(u => u.id === userData.id);

    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...userData };
    } else {
      if (!userData.id) {
        userData.id = "user_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      }
      userData.createdAt = new Date().toISOString();
      users.push(userData);
    }

    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    return userData;
  }

  // --- SESSION ---
  getSession() {
    try {
      const data = localStorage.getItem(this.KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  setSession(user) {
    if (!user) {
      localStorage.removeItem(this.KEYS.SESSION);
    } else {
      // Don't store password in session for security best practice
      const safeUser = { ...user };
      delete safeUser.password;
      localStorage.setItem(this.KEYS.SESSION, JSON.stringify(safeUser));
    }
  }

  clearSession() {
    localStorage.removeItem(this.KEYS.SESSION);
  }

  // --- ATTEMPTS & HISTORY ---
  getAttempts() {
    try {
      const data = localStorage.getItem(this.KEYS.ATTEMPTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  getAttemptsByUserId(userId) {
    const attempts = this.getAttempts();
    return attempts.filter(a => a.userId === userId).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }

  saveAttempt(attemptData) {
    const attempts = this.getAttempts();
    if (!attemptData.id) {
      attemptData.id = "att_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    if (!attemptData.completedAt) {
      attemptData.completedAt = new Date().toISOString();
    }
    attempts.unshift(attemptData);
    localStorage.setItem(this.KEYS.ATTEMPTS, JSON.stringify(attempts));
    return attemptData;
  }

  getAttemptById(attemptId) {
    const attempts = this.getAttempts();
    return attempts.find(a => a.id === attemptId) || null;
  }

  updateUserAttemptsMetadata(userId, newName, newAvatar) {
    const attempts = this.getAttempts();
    let modified = false;
    attempts.forEach(att => {
      if (att.userId === userId) {
        if (newName) att.userName = newName;
        if (newAvatar) att.userAvatar = newAvatar;
        modified = true;
      }
    });
    if (modified) {
      localStorage.setItem(this.KEYS.ATTEMPTS, JSON.stringify(attempts));
    }
  }

  // --- LEADERBOARD & AGGREGATIONS ---
  getLeaderboard(category = "all", quizId = "all") {
    let attempts = this.getAttempts();

    if (category && category !== "all") {
      attempts = attempts.filter(a => a.category === category);
    }
    if (quizId && quizId !== "all") {
      attempts = attempts.filter(a => a.quizId === quizId);
    }

    // Group by user to find highest score / aggregated stats
    const userMap = {};

    attempts.forEach(att => {
      if (!userMap[att.userId]) {
        userMap[att.userId] = {
          userId: att.userId,
          userName: att.userName || "Anonymous Student",
          userAvatar: att.userAvatar || "🎓",
          totalScore: 0,
          maxPossibleScore: 0,
          quizzesAttempted: 0,
          passedQuizzes: 0,
          bestPercentage: 0,
          lastAttemptDate: att.completedAt
        };
      }

      userMap[att.userId].totalScore += att.score;
      userMap[att.userId].maxPossibleScore += (att.totalMarks || 20);
      userMap[att.userId].quizzesAttempted += 1;
      if (att.passed) userMap[att.userId].passedQuizzes += 1;
      if (att.percentage > userMap[att.userId].bestPercentage) {
        userMap[att.userId].bestPercentage = att.percentage;
      }
    });

    const leaderboard = Object.values(userMap).map(u => {
      const avgPercentage = u.maxPossibleScore > 0 ? Math.round((u.totalScore / u.maxPossibleScore) * 100) : 0;
      const accountUser = this.getUserById(u.userId);
      return {
        ...u,
        userEmail: accountUser?.email || `${u.userName.toLowerCase().replace(/\s+/g, '')}@student.edu`,
        role: accountUser?.role || "student",
        joinedDate: accountUser?.createdAt || u.lastAttemptDate,
        avgPercentage
      };
    });

    // Sort primarily by totalScore descending, then by avgPercentage descending
    leaderboard.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return b.avgPercentage - a.avgPercentage;
    });

    return leaderboard;
  }

  // --- PLATFORM STATS ---
  getAdminStats() {
    const quizzes = this.getQuizzes();
    const users = this.getUsers();
    const attempts = this.getAttempts();

    let totalMarksEarned = 0;
    let totalMaxMarks = 0;
    let totalPassed = 0;

    attempts.forEach(a => {
      totalMarksEarned += (a.score || 0);
      totalMaxMarks += (a.totalMarks || 20);
      if (a.passed) totalPassed++;
    });

    const averageAccuracy = totalMaxMarks > 0 ? Math.round((totalMarksEarned / totalMaxMarks) * 100) : 0;
    const passRate = attempts.length > 0 ? Math.round((totalPassed / attempts.length) * 100) : 0;

    return {
      totalUsers: users.length,
      totalStudents: users.filter(u => u.role === "student").length,
      totalQuizzes: quizzes.length,
      totalAttempts: attempts.length,
      averageAccuracy,
      passRate
    };
  }

  getUserStats(userId) {
    const attempts = this.getAttemptsByUserId(userId);
    let totalScore = 0;
    let totalMax = 0;
    let passedCount = 0;
    const categoryCounts = {};

    attempts.forEach(a => {
      totalScore += (a.score || 0);
      totalMax += (a.totalMarks || 20);
      if (a.passed) passedCount++;
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    });

    // Find top category
    let topCategory = "None";
    let maxCatCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCatCount) {
        maxCatCount = count;
        topCategory = cat;
      }
    }

    const avgScorePct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    return {
      totalAttempts: attempts.length,
      passedCount,
      avgScorePct,
      totalScore,
      topCategory
    };
  }

  // --- SETTINGS ---
  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      return data ? JSON.parse(data) : { theme: "dark", sound: true };
    } catch (e) {
      return { theme: "dark", sound: true };
    }
  }

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- BACKUP & RESET ---
  resetToDefaults() {
    localStorage.removeItem(this.KEYS.QUIZZES);
    localStorage.removeItem(this.KEYS.USERS);
    localStorage.removeItem(this.KEYS.ATTEMPTS);
    this.initialize();
  }

  exportDataJSON() {
    return JSON.stringify({
      quizzes: this.getQuizzes(),
      users: this.getUsers(),
      attempts: this.getAttempts(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  importDataJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.quizzes && Array.isArray(data.quizzes)) {
        localStorage.setItem(this.KEYS.QUIZZES, JSON.stringify(data.quizzes));
      }
      if (data.users && Array.isArray(data.users)) {
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(data.users));
      }
      if (data.attempts && Array.isArray(data.attempts)) {
        localStorage.setItem(this.KEYS.ATTEMPTS, JSON.stringify(data.attempts));
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

window.storageService = new StorageService();
