const express = require('express');
const router = express.Router();
const { getAssignmentLinks } = require('../scraper/getAssignmentLinks');

router.post('/scrape-assignments', async (req, res) => {
  const { courseUrl } = req.body;

  if (!courseUrl || !courseUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid or missing courseUrl' });
  }

  try {
    const result = await getAssignmentLinks(courseUrl);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed. Try again.' });
  }
});

const pool = require('../db');

router.get('/assignments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});


module.exports = router;
