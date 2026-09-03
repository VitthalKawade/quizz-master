const express = require('express');
const db = require('../database/db');
const { verifyToken, requireAdmin, optionalToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/quizzes - List all quizzes
router.get('/', optionalToken, (req, res) => {
  try {
    const { category, search } = req.query;
    let quizzes = db.getQuizzes();

    if (category && category !== 'all') {
      quizzes = quizzes.filter(q => q.category && q.category.toLowerCase() === category.toLowerCase());
    }

    if (search && search.trim()) {
      const qLower = search.toLowerCase().trim();
      quizzes = quizzes.filter(q =>
        (q.title && q.title.toLowerCase().includes(qLower)) ||
        (q.testCode && q.testCode.toLowerCase().includes(qLower)) ||
        (q.category && q.category.toLowerCase().includes(qLower)) ||
        (q.description && q.description.toLowerCase().includes(qLower))
      );
    }

    // Hide question correct answers from regular students when listing
    const sanitized = quizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      category: quiz.category,
      testCode: quiz.testCode,
      hasPassword: !!(quiz.password && quiz.password.trim()),
      password: (req.user && req.user.role === 'admin') ? quiz.password : undefined,
      icon: quiz.icon,
      difficulty: quiz.difficulty,
      durationMinutes: quiz.durationMinutes,
      passPercentage: quiz.passPercentage,
      totalMarks: quiz.totalMarks,
      description: quiz.description,
      questionCount: (quiz.questions || []).length,
      createdAt: quiz.createdAt
    }));

    return res.json({ success: true, count: sanitized.length, quizzes: sanitized });
  } catch (err) {
    console.error('Fetch quizzes error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching quizzes.' });
  }
});

// GET /api/quizzes/:id - Get a single quiz by ID or Test Code
router.get('/:id', optionalToken, (req, res) => {
  try {
    const { id } = req.params;
    let quiz = db.getQuizById(id);
    if (!quiz) {
      quiz = db.getQuizByCode(id);
    }

    if (!quiz) {
      return res.status(404).json({ success: false, message: `Quiz with ID or code "${id}" was not found.` });
    }

    const isAdmin = req.user && req.user.role === 'admin';

    // If student taking quiz, do not leak correctAnswer and explanation before submission
    const sanitizedQuestions = (quiz.questions || []).map((q, idx) => ({
      id: q.id || `q_${idx}`,
      question: q.question,
      options: q.options,
      marks: q.marks || 2,
      correctAnswer: isAdmin ? q.correctAnswer : undefined,
      explanation: isAdmin ? q.explanation : undefined
    }));

    return res.json({
      success: true,
      quiz: {
        ...quiz,
        hasPassword: !!(quiz.password && quiz.password.trim()),
        password: isAdmin ? quiz.password : undefined,
        questions: sanitizedQuestions
      }
    });
  } catch (err) {
    console.error('Fetch quiz by ID error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching quiz.' });
  }
});

// POST /api/quizzes/:id/unlock - Validate test access password
router.post('/:id/unlock', (req, res) => {
  try {
    const { id } = req.params;
    const { password = '' } = req.body;

    const quiz = db.getQuizById(id) || db.getQuizByCode(id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    if (!quiz.password || quiz.password.trim() === '') {
      return res.json({ success: true, unlocked: true });
    }

    if (quiz.password !== password) {
      return res.status(401).json({ success: false, unlocked: false, message: 'Incorrect test password. Please verify with your instructor.' });
    }

    return res.json({ success: true, unlocked: true });
  } catch (err) {
    console.error('Unlock quiz error:', err);
    return res.status(500).json({ success: false, message: 'Server error unlocking quiz.' });
  }
});

// POST /api/quizzes - Create new quiz (Admin only)
router.post('/', verifyToken, requireAdmin, (req, res) => {
  try {
    const { title, category, testCode, password, icon, difficulty, durationMinutes, passPercentage, totalMarks, description, questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Quiz title is required.' });
    }

    const created = db.createQuiz({
      title: title.trim(),
      category: category || 'Programming',
      testCode: testCode ? testCode.trim().toUpperCase() : undefined,
      password: password || '',
      icon: icon || '📝',
      difficulty: difficulty || 'Medium',
      durationMinutes: durationMinutes || 15,
      passPercentage: passPercentage || 60,
      totalMarks: totalMarks || 20,
      description: description || '',
      questions: questions || []
    });

    return res.status(201).json({
      success: true,
      message: `Quiz "${created.title}" created successfully!`,
      quiz: created
    });
  } catch (err) {
    console.error('Create quiz error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating quiz.' });
  }
});

// PUT /api/quizzes/:id - Update quiz (Admin only)
router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getQuizById(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const updated = db.updateQuiz(id, req.body);
    return res.json({
      success: true,
      message: `Quiz "${updated.title}" updated successfully!`,
      quiz: updated
    });
  } catch (err) {
    console.error('Update quiz error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating quiz.' });
  }
});

// DELETE /api/quizzes/:id - Delete quiz (Admin only)
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getQuizById(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    db.deleteQuiz(id);
    return res.json({
      success: true,
      message: `Quiz "${existing.title}" deleted successfully.`
    });
  } catch (err) {
    console.error('Delete quiz error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting quiz.' });
  }
});

module.exports = router;
