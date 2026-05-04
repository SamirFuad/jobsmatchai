const { Router } = require('express');
const { db } = require('../database');
const { hashPassword, verifyPassword, createAccessToken } = require('../services/authService');

const router = Router();

/**
 * Helper: build user response with skills loaded.
 */
function getUserWithSkills(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  const skills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, us.proficiency
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ?
  `).all(userId);

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role || 'searcher',
    status: user.status || 'active',
    company_name: user.company_name || null,
    employer_type: user.employer_type || null,
    phone_number: user.phone_number || null,
    bio: user.bio || null,
    profile_picture: user.profile_picture || null,
    title: user.title || null,
    experience_years: user.experience_years || null,
    education_level: user.education_level || null,
    cv_filename: user.cv_filename || null,
    created_at: user.created_at,
    skills: skills.map((s) => ({
      skill_name: s.skill_name,
      skill_category: s.skill_category,
      proficiency: s.proficiency || null,
    })),
  };
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, full_name, title, experience_years, education_level, role, company_name, employer_type } = req.body;

  // Validation
  if (!email || !password || !full_name) {
    return res.status(422).json({ detail: 'email, password, and full_name are required' });
  }
  if (password.length < 8) {
    return res.status(422).json({ detail: 'Password must be at least 8 characters' });
  }

  // Validate role
  const validRoles = ['searcher', 'employer', 'admin'];
  const userRole = role || 'searcher';
  if (!validRoles.includes(userRole)) {
    return res.status(422).json({ detail: 'Invalid role. Must be: searcher, employer, or admin' });
  }

  // Employer requires company_name
  if (userRole === 'employer' && !company_name) {
    return res.status(422).json({ detail: 'company_name is required for employer accounts' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(400).json({ detail: 'Email already registered' });
  }

  // Create user
  try {
    const result = db.prepare(`
      INSERT INTO users (email, hashed_password, full_name, role, company_name, employer_type, title, experience_years, education_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizedEmail,
      hashPassword(password),
      full_name,
      userRole,
      company_name || null,
      (userRole === 'employer' ? (employer_type || 'company') : null),
      title || null,
      experience_years || null,
      education_level || null
    );

    const userOut = getUserWithSkills(result.lastInsertRowid);
    return res.status(201).json(userOut);
  } catch (err) {
    console.error('CRITICAL REGISTRATION ERROR:', err);
    return res.status(500).json({ detail: 'Database save failed' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ detail: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (!user || !verifyPassword(password, user.hashed_password)) {
    return res.status(401).json({ detail: 'Invalid credentials' });
  }

  // Block suspended users
  if (user.status === 'suspended') {
    return res.status(403).json({ detail: 'Your account has been suspended. Contact an administrator.' });
  }

  const token = createAccessToken({ sub: String(user.id) });
  return res.json({ access_token: token, token_type: 'bearer', role: user.role });
});

module.exports = { router, getUserWithSkills };
