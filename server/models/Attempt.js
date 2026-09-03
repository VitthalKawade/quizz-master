const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: true,
    default: () => 'att_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    default: 'Student'
  },
  userEmail: {
    type: String,
    default: ''
  },
  userAvatar: {
    type: String,
    default: '🎓'
  },
  quizId: {
    type: String,
    required: true
  },
  quizTitle: {
    type: String,
    default: 'Quiz'
  },
  category: {
    type: String,
    default: 'General Knowledge'
  },
  testCode: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    default: 'Medium'
  },
  score: {
    type: Number,
    required: true,
    default: 0
  },
  totalMarks: {
    type: Number,
    required: true,
    default: 20
  },
  percentage: {
    type: Number,
    required: true,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  passPercentage: {
    type: Number,
    default: 60
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  correctCount: {
    type: Number,
    default: 0
  },
  wrongCount: {
    type: Number,
    default: 0
  },
  unansweredCount: {
    type: Number,
    default: 0
  },
  timeSpentSeconds: {
    type: Number,
    default: 0
  },
  answersBreakdown: [{
    type: mongoose.Schema.Types.Mixed
  }],
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      delete ret._id;
      return ret;
    }
  }
});

module.exports = mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema);
