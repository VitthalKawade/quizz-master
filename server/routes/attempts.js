const express = require('express');
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/attempts - Submit & Server-Side Evaluate Quiz Attempt
router.post('/', verifyToken, (req, res) => {
  try {
    const { quizId, userAnswers = {}, timeSpentSeconds = 0 } = req.body;
    const user = req.user;

    const quiz = db.getQuizById(quizId) || db.getQuizByCode(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const questions = quiz.questions || [];
    let earnedMarks = 0;
    let totalMarks = quiz.totalMarks || (questions.length * 2) || 20;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const answersBreakdown = questions.map((q, idx) => {
      const userSelected = userAnswers[idx] !== undefined ? userAnswers[idx] : null;
      const isUnanswered = userSelected === null || userSelected === undefined;
      const isCorrect = !isUnanswered && userSelected === q.correctAnswer;
      const marksForQ = q.marks || 2;

      if (isUnanswered) {
        unansweredCount++;
      } else if (isCorrect) {
        correctCount++;
        earnedMarks += marksForQ;
      } else {
        wrongCount++;
      }

      return {
        questionIndex: idx,
        questionId: q.id || `q_${idx}`,
        questionText: q.question,
        options: q.options,
        userAnswerIndex: userSelected,
        userAnswerText: userSelected !== null && q.options ? q.options[userSelected] : null,
        correctAnswerIndex: q.correctAnswer,
        correctAnswerText: q.options ? q.options[q.correctAnswer] : null,
        isCorrect,
        isUnanswered,
        marks: marksForQ,
        earnedMarks: isCorrect ? marksForQ : 0,
        explanation: q.explanation || ''
      };
    });

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const passingThreshold = quiz.passPercentage || 60;
    const passed = percentage >= passingThreshold;

    const attemptRecord = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar || '🎓',
      quizId: quiz.id,
      quizTitle: quiz.title,
      category: quiz.category,
      testCode: quiz.testCode,
      difficulty: quiz.difficulty,
      score: earnedMarks,
      totalMarks,
      percentage,
      passed,
      passPercentage: passingThreshold,
      totalQuestions: questions.length,
      correctCount,
      wrongCount,
      unansweredCount,
      timeSpentSeconds: parseInt(timeSpentSeconds) || 0,
      answersBreakdown
    };

    const savedAttempt = db.createAttempt(attemptRecord);

    return res.status(201).json({
      success: true,
      message: passed ? 'Congratulations! You passed the test! 🎉' : 'Assessment completed.',
      attempt: savedAttempt
    });
  } catch (err) {
    console.error('Submit quiz attempt error:', err);
    return res.status(500).json({ success: false, message: 'Server error evaluating quiz attempt.' });
  }
});

// GET /api/attempts - Get history of attempts
router.get('/', verifyToken, (req, res) => {
  try {
    const user = req.user;
    const { userId, quizId } = req.query;

    let attempts = [];
    if (user.role === 'admin') {
      attempts = db.getAttempts(userId || null);
    } else {
      attempts = db.getAttempts(user.id);
    }

    if (quizId) {
      attempts = attempts.filter(a => a.quizId === quizId);
    }

    return res.json({ success: true, count: attempts.length, attempts });
  } catch (err) {
    console.error('Get attempts error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving attempts.' });
  }
});

// GET /api/attempts/:id - Get specific attempt by ID
router.get('/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const attempt = db.getAttemptById(id);

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt record not found.' });
    }

    // Students can only view their own attempts
    if (req.user.role !== 'admin' && attempt.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this attempt record.' });
    }

    return res.json({ success: true, attempt });
  } catch (err) {
    console.error('Get attempt by ID error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving attempt record.' });
  }
});

module.exports = router;
