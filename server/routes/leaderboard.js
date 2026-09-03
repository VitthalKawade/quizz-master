const express = require('express');
const db = require('../database/db');

const router = express.Router();

// GET /api/leaderboard - Get dynamic leaderboard rankings
router.get('/', (req, res) => {
  try {
    const { category = 'all' } = req.query;
    const rankings = db.getLeaderboard(category);

    return res.json({
      success: true,
      category,
      count: rankings.length,
      leaderboard: rankings
    });
  } catch (err) {
    console.error('Fetch leaderboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error computing leaderboard rankings.' });
  }
});

module.exports = router;
