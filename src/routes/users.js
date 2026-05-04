const { Router } = require('express');
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { getUserWithSkills } = require('./auth');
const { getAllSkillsFlat } = require('../services/nlpEngine');

const router = Router();

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

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  const userOut = getUserWithSkills(req.user.id);
  if (!userOut) return res.status(404).json({ detail: 'User not found' });
  return res.json(userOut);
});

// PUT /api/users/me
router.put('/me', requireAuth, (req, res) => {
  const { full_name, title, experience_years, education_level, phone_number, bio, profile_picture, company_name, employer_type } = req.body;
  const userId = req.user.id;

  try {
    const fields = [];
    const values = [];

    if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (experience_years !== undefined) { fields.push('experience_years = ?'); values.push(experience_years); }
    if (education_level !== undefined) { fields.push('education_level = ?'); values.push(education_level); }
    if (phone_number !== undefined) { fields.push('phone_number = ?'); values.push(phone_number); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
    if (profile_picture !== undefined) { fields.push('profile_picture = ?'); values.push(profile_picture); }
    if (company_name !== undefined) { fields.push('company_name = ?'); values.push(company_name); }
    if (employer_type !== undefined) { fields.push('employer_type = ?'); values.push(employer_type); }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const userOut = getUserWithSkills(userId);
    return res.json(userOut);
  } catch {
    return res.status(500).json({ detail: 'Failed to update profile' });
  }
});

// POST /api/users/me/skills
router.post('/me/skills', requireAuth, (req, res) => {
  const { skills, experience_years, education_level } = req.body;
  const userId = req.user.id;

  if (!skills || !Array.isArray(skills)) {
    return res.status(422).json({ detail: 'skills array is required' });
  }

  try {
    const updateSkills = db.transaction(() => {
      // Clear existing user skills
      db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId);

      // Update metadata
      if (experience_years !== undefined && experience_years !== null) {
        db.prepare('UPDATE users SET experience_years = ? WHERE id = ?').run(experience_years, userId);
      }
      if (education_level !== undefined && education_level !== null) {
        db.prepare('UPDATE users SET education_level = ? WHERE id = ?').run(education_level, userId);
      }

      // Add new skills
      const insertUserSkill = db.prepare('INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)');
      for (const skillName of skills) {
        const skill = getOrCreateSkill(skillName);
        insertUserSkill.run(userId, skill.id);
      }
    });

    updateSkills();

    const userOut = getUserWithSkills(userId);
    return res.json(userOut);
  } catch (err) {
    console.error('Skill save error:', err);
    return res.status(500).json({ detail: 'Database error during skill save' });
  }
});

module.exports = router;
