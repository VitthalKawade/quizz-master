const express = require('express');
const db = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/quizzes/:quizId/questions
router.get('/', verifyToken, (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = db.getQuizById(quizId) || db.getQuizByCode(quizId);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const isAdmin = req.user.role === 'admin';
    const questions = (quiz.questions || []).map((q, idx) => ({
      id: q.id || `q_${idx}`,
      question: q.question,
      options: q.options,
      marks: q.marks || 2,
      correctAnswer: isAdmin ? q.correctAnswer : undefined,
      explanation: isAdmin ? q.explanation : undefined
    }));

    return res.json({ success: true, count: questions.length, questions });
  } catch (err) {
    console.error('Fetch questions error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching questions.' });
  }
});

// POST /api/quizzes/:quizId/questions - Add a new question
router.post('/', verifyToken, requireAdmin, (req, res) => {
  try {
    const { quizId } = req.params;
    const { question, options, correctAnswer, marks, explanation } = req.body;

    const quiz = db.getQuizById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question text is required.' });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 answer options are required.' });
    }

    const newQuestion = {
      id: 'q_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      question: question.trim(),
      options: options.map(o => o.trim()),
      correctAnswer: parseInt(correctAnswer) || 0,
      marks: parseInt(marks) || 2,
      explanation: (explanation || '').trim()
    };

    if (!quiz.questions) quiz.questions = [];
    quiz.questions.push(newQuestion);
    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);

    db.updateQuiz(quiz.id, {
      questions: quiz.questions,
      totalMarks: quiz.totalMarks
    });

    return res.status(201).json({
      success: true,
      message: 'Question added successfully.',
      question: newQuestion,
      totalQuestions: quiz.questions.length
    });
  } catch (err) {
    console.error('Add question error:', err);
    return res.status(500).json({ success: false, message: 'Server error adding question.' });
  }
});

// PUT /api/quizzes/:quizId/questions/:qIndex - Update question by index
router.put('/:qIndex', verifyToken, requireAdmin, (req, res) => {
  try {
    const { quizId, qIndex } = req.params;
    const index = parseInt(qIndex);

    const quiz = db.getQuizById(quizId);
    if (!quiz || !quiz.questions || !quiz.questions[index]) {
      return res.status(404).json({ success: false, message: 'Question not found at index.' });
    }

    const { question, options, correctAnswer, marks, explanation } = req.body;

    if (question !== undefined) quiz.questions[index].question = question.trim();
    if (Array.isArray(options)) quiz.questions[index].options = options.map(o => o.trim());
    if (correctAnswer !== undefined) quiz.questions[index].correctAnswer = parseInt(correctAnswer);
    if (marks !== undefined) quiz.questions[index].marks = parseInt(marks);
    if (explanation !== undefined) quiz.questions[index].explanation = explanation.trim();

    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);

    db.updateQuiz(quiz.id, {
      questions: quiz.questions,
      totalMarks: quiz.totalMarks
    });

    return res.json({
      success: true,
      message: `Question #${index + 1} updated successfully.`,
      question: quiz.questions[index]
    });
  } catch (err) {
    console.error('Update question error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating question.' });
  }
});

// DELETE /api/quizzes/:quizId/questions/:qIndex - Delete question by index
router.delete('/:qIndex', verifyToken, requireAdmin, (req, res) => {
  try {
    const { quizId, qIndex } = req.params;
    const index = parseInt(qIndex);

    const quiz = db.getQuizById(quizId);
    if (!quiz || !quiz.questions || !quiz.questions[index]) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    quiz.questions.splice(index, 1);
    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);

    db.updateQuiz(quiz.id, {
      questions: quiz.questions,
      totalMarks: quiz.totalMarks
    });

    return res.json({
      success: true,
      message: `Question #${index + 1} removed successfully.`,
      remainingQuestions: quiz.questions.length
    });
  } catch (err) {
    console.error('Delete question error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting question.' });
  }
});

// POST /api/quizzes/:quizId/questions/bulk - Bulk add/replace questions
router.post('/bulk', verifyToken, requireAdmin, (req, res) => {
  try {
    const { quizId } = req.params;
    const { questions, mode = 'append' } = req.body; // mode: 'append' | 'replace'

    const quiz = db.getQuizById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions array is required and cannot be empty.' });
    }

    const formattedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.question.trim()) {
        return res.status(400).json({ success: false, message: `Question #${i + 1} has empty question text.` });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ success: false, message: `Question #${i + 1} must have at least 2 options.` });
      }

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

      if (correctIdx < 0 || correctIdx >= q.options.length) {
        correctIdx = 0;
      }

      formattedQuestions.push({
        id: q.id || ('q_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
        question: q.question.trim(),
        options: q.options.map(opt => String(opt).trim()),
        correctAnswer: correctIdx,
        marks: parseInt(q.marks) || 2,
        explanation: (q.explanation || '').trim()
      });
    }

    if (mode === 'replace') {
      quiz.questions = formattedQuestions;
    } else {
      if (!quiz.questions) quiz.questions = [];
      quiz.questions.push(...formattedQuestions);
    }

    quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 2), 0);

    db.updateQuiz(quiz.id, {
      questions: quiz.questions,
      totalMarks: quiz.totalMarks
    });

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${formattedQuestions.length} question(s) (${mode} mode).`,
      importedCount: formattedQuestions.length,
      totalQuestions: quiz.questions.length,
      totalMarks: quiz.totalMarks
    });
  } catch (err) {
    console.error('Bulk add questions error:', err);
    return res.status(500).json({ success: false, message: 'Server error bulk adding questions.' });
  }
});

module.exports = router;
