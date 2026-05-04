const { Router } = require('express');
const multer = require('multer');
const { db } = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { parseCv, parseCvFromText } = require('../services/nlpEngine');
const { getAllSkillsFlat } = require('../services/nlpEngine');
const config = require('../config');

const router = Router();

// Configure multer for in-memory file handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('Only PDF files are supported'));
    }
    cb(null, true);
  },
});

/**
 * Helper: get or create a skill by name.
 */
function getOrCreateSkill(name) {
  let skill = db.prepare('SELECT * FROM skills WHERE LOWER(name) = LOWER(?)').get(name);

  if (!skill) {
    let category = 'general';
    for (const s of getAllSkillsFlat()) {
      if (s.name.toLowerCase() === name.toLowerCase()) {
        category = s.category;
        break;
      }
    }
    const result = db.prepare('INSERT INTO skills (name, category) VALUES (?, ?)').run(name, category);
    skill = { id: result.lastInsertRowid, name, category };
  }

  return skill;
}

// POST /api/cv/parse
router.post('/parse', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ detail: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ detail: 'No file uploaded' });
    }

    try {
      const result = await parseCv(req.file.buffer);
      return res.json({
        success: true,
        message: `Successfully extracted ${result.extracted_skills.length} skills`,
        data: result,
      });
    } catch (e) {
      return res.json({
        success: false,
        message: e.message,
        data: null,
      });
    }
  });
});

// POST /api/cv/parse-and-save
router.post('/parse-and-save', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ detail: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ detail: 'No file uploaded' });
    }

    try {
      const result = await parseCv(req.file.buffer);

      // Update user metadata
      const userId = req.user.id;

      const saveTransaction = db.transaction(() => {
        // Update user fields
        const updateFields = ['cv_text = ?', 'cv_filename = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const updateValues = [result.raw_text, req.file.originalname];

        if (result.experience_years && !req.user.experience_years) {
          updateFields.push('experience_years = ?');
          updateValues.push(result.experience_years);
        }
        if (result.education_level && !req.user.education_level) {
          updateFields.push('education_level = ?');
          updateValues.push(result.education_level);
        }

        updateValues.push(userId);
        db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);

        // Clear old skills
        db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId);

        // Add new skills
        const insertUserSkill = db.prepare('INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)');
        for (const skillName of result.extracted_skills) {
          const skill = getOrCreateSkill(skillName);
          insertUserSkill.run(userId, skill.id);
        }
      });

      saveTransaction();

      return res.json({
        success: true,
        message: `CV parsed and ${result.extracted_skills.length} skills saved to profile`,
        data: result,
      });
    } catch (e) {
      console.error('CV parse-and-save error:', e);
      return res.status(500).json({ detail: 'Database error during save' });
    }
  });
});

// POST /api/cv/parse-text
router.post('/parse-text', (req, res) => {
  // The frontend sends text as a query parameter
  const text = req.query.text || (req.body && req.body.text) || '';

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ detail: 'Text too short' });
  }

  const result = parseCvFromText(text);
  return res.json({
    success: true,
    message: `Extracted ${result.extracted_skills.length} skills from text`,
    data: result,
  });
});

module.exports = router;
