const { Router } = require('express');
const { db } = require('../database');
const { getAllSkillsFlat } = require('../services/nlpEngine');

const router = Router();

// GET /api/skills/
router.get('/', (req, res) => {
  const { category, search, skip = '0', limit = '50' } = req.query;

  let whereClauses = [];
  let params = [];

  if (category) {
    whereClauses.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }
  if (search) {
    whereClauses.push('name LIKE ?');
    params.push(`%${search}%`);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM skills ${whereSQL}`).get(...params).cnt;

  const skills = db.prepare(`
    SELECT id, name, category FROM skills ${whereSQL}
    ORDER BY name
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), parseInt(skip, 10));

  return res.json({ skills, total });
});

// POST /api/skills/seed
router.post('/seed', (req, res) => {
  const allCuratedSkills = getAllSkillsFlat();

  // Get all existing skill names in one query
  const existingRows = db.prepare('SELECT name FROM skills').all();
  const existingNames = new Set(existingRows.map((r) => r.name.toLowerCase()));

  let added = 0;
  let skipped = 0;

  const seedTransaction = db.transaction(() => {
    const insert = db.prepare('INSERT INTO skills (name, category) VALUES (?, ?)');
    for (const { name, category } of allCuratedSkills) {
      if (existingNames.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      insert.run(name, category);
      added++;
    }
  });

  seedTransaction();

  return res.status(201).json({
    message: 'Skills seeding complete',
    added,
    skipped,
  });
});

// GET /api/skills/categories
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT category, COUNT(id) as count
    FROM skills
    GROUP BY category
    ORDER BY category
  `).all();

  const categories = rows.map((r) => ({ name: r.category, count: r.count }));
  return res.json({ categories });
});

module.exports = router;
