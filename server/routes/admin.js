const express = require('express');
const db = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply admin guard to all admin routes
router.use(verifyToken, requireAdmin);

// GET /api/admin/metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = db.getAdminMetrics();
    return res.json({ success: true, metrics });
  } catch (err) {
    console.error('Fetch admin metrics error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving admin metrics.' });
  }
});

// GET /api/admin/export - Export full database
router.get('/export', (req, res) => {
  try {
    const backup = db.exportAll();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=quizzmaster-backup-${Date.now()}.json`);
    return res.json(backup);
  } catch (err) {
    console.error('Export database error:', err);
    return res.status(500).json({ success: false, message: 'Server error exporting database.' });
  }
});

// POST /api/admin/import - Import / Restore database
router.post('/import', (req, res) => {
  try {
    const payload = req.body;
    db.importAll(payload);
    return res.json({ success: true, message: 'Database restored successfully!' });
  } catch (err) {
    console.error('Import database error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Server error importing database.' });
  }
});

// POST /api/admin/reset - Reset to factory defaults
router.post('/reset', (req, res) => {
  try {
    db.resetAll();
    return res.json({ success: true, message: 'Database reset to factory defaults successfully.' });
  } catch (err) {
    console.error('Reset database error:', err);
    return res.status(500).json({ success: false, message: 'Server error resetting database.' });
  }
});

// GET /api/admin/submissions/export-csv - Export all student score records as CSV
router.get('/submissions/export-csv', (req, res) => {
  try {
    const attempts = db.getAttempts() || [];
    
    // Header row
    const headers = [
      'Attempt ID',
      'Student Name',
      'Student Email',
      'Quiz Title',
      'Test Code',
      'Category',
      'Score Obtained',
      'Total Marks',
      'Percentage (%)',
      'Result Status',
      'Time Spent (Seconds)',
      'Time Spent (Formatted)',
      'Submission Date & Time'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = attempts.map(a => {
      const mins = Math.floor((a.timeSpentSeconds || 0) / 60);
      const secs = (a.timeSpentSeconds || 0) % 60;
      const timeFormatted = `${mins}m ${secs}s`;

      return [
        escapeCsv(a.id),
        escapeCsv(a.userName || 'Student'),
        escapeCsv(a.userEmail || 'N/A'),
        escapeCsv(a.quizTitle || 'Quiz'),
        escapeCsv(a.testCode || 'N/A'),
        escapeCsv(a.category || 'General'),
        escapeCsv(a.score || 0),
        escapeCsv(a.totalMarks || 0),
        escapeCsv(a.percentage || 0),
        escapeCsv(a.passed ? 'PASSED' : 'FAILED'),
        escapeCsv(a.timeSpentSeconds || 0),
        escapeCsv(timeFormatted),
        escapeCsv(new Date(a.completedAt).toLocaleString())
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `quizzmaster_student_scores_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('Export submissions CSV error:', err);
    return res.status(500).json({ success: false, message: 'Server error exporting submissions CSV.' });
  }
});

module.exports = router;
