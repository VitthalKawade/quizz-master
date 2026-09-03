const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => 'q_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    required: true,
    trim: true
  }],
  correctAnswer: {
    type: Number,
    required: true,
    default: 0
  },
  marks: {
    type: Number,
    default: 2
  },
  explanation: {
    type: String,
    default: '',
    trim: true
  }
}, { _id: false });

const quizSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: true,
    default: () => 'quiz_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    default: 'General Knowledge'
  },
  testCode: {
    type: String,
    uppercase: true,
    trim: true
  },
  password: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '📝'
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  durationMinutes: {
    type: Number,
    default: 15
  },
  passPercentage: {
    type: Number,
    default: 60
  },
  totalMarks: {
    type: Number,
    default: 20
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  questions: [questionSchema],
  createdAt: {
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

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
