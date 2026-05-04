const { Router } = require('express');
const { db } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculateMatchScore } = require('../services/matchingEngine');

const router = Router();

// All talent routes require employer or admin
router.use(requireAuth, requireRole('employer', 'admin'));

/**
 * Fuzzy stem extraction — strips common suffixes to enable
 * "economist" ↔ "economics" ↔ "economy" style matching.
 */
function extractStem(word) {
  const w = word.toLowerCase().trim();
  // Strip common suffixes for fuzzy matching
  return w
    .replace(/(ment|tion|sion|ness|ity|ance|ence|ment|ical|ious|eous|ive|ist|ism|ing|ment|er|or|al|ly|ed|es|s)$/i, '')
    .substring(0, Math.max(3, w.length - 2)); // keep at least 3 chars
}

/**
 * GET /api/talent/search
 * Global talent search with fuzzy matching on title, skills, education.
 */
router.get('/search', (req, res) => {
  const { q, skills, education, limit = '20', offset = '0' } = req.query;

  let whereClauses = ["u.role = 'searcher'", "u.status = 'active'"];
  let params = [];

  // Fuzzy match on title or full_name
  if (q) {
    const stem = extractStem(q);
    whereClauses.push('(u.title LIKE ? OR u.full_name LIKE ? OR u.bio LIKE ?)');
    params.push(`%${stem}%`, `%${stem}%`, `%${stem}%`);
  }

  // Fuzzy match on education_level
  if (education) {
    const eduStem = extractStem(education);
    // Also match common abbreviations
    const eduUpper = education.toUpperCase().trim();
    const eduVariants = [eduStem];
    
    // Map common degree abbreviations
    const degreeMap = {
      'MSC': ['master', 'msc', 'ms'],
      'MBA': ['master', 'mba', 'business'],
      'BSC': ['bachelor', 'bsc', 'bs'],
      'PHD': ['doctor', 'phd', 'ph.d'],
      'MASTER': ['master', 'msc', 'ms', 'mba'],
      'BACHELOR': ['bachelor', 'bsc', 'bs', 'ba'],
      'DOCTORATE': ['doctor', 'phd', 'ph.d'],
    };

    const mapped = degreeMap[eduUpper] || [eduStem];
    const eduConditions = mapped.map(() => 'u.education_level LIKE ?').join(' OR ');
    whereClauses.push(`(${eduConditions})`);
    mapped.forEach(v => params.push(`%${v}%`));
  }

  // Filter by skills (comma-separated)
  let skillFilter = null;
  if (skills) {
    skillFilter = skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  const whereSQL = whereClauses.join(' AND ');
  const lim = parseInt(limit, 10);
  const off = parseInt(offset, 10);

  // Get matching users
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.full_name, u.email, u.title, u.experience_years,
           u.education_level, u.cv_filename, u.company_name, u.bio, u.profile_picture,
           u.created_at
    FROM users u
    WHERE ${whereSQL}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, off);

  const total = db.prepare(`
    SELECT COUNT(DISTINCT u.id) as cnt FROM users u WHERE ${whereSQL}
  `).get(...params).cnt;

  // Load skills for each user and apply skill filter
  const results = [];
  for (const user of users) {
    const userSkills = db.prepare(`
      SELECT s.name AS skill_name, s.category AS skill_category, us.proficiency
      FROM user_skills us
      JOIN skills s ON s.id = us.skill_id
      WHERE us.user_id = ?
    `).all(user.id);

    const skillNames = userSkills.map(s => s.skill_name.toLowerCase());

    // If skill filter is active, check that user has at least one matching skill
    if (skillFilter && skillFilter.length > 0) {
      const hasMatch = skillFilter.some(sf => {
        const sfStem = extractStem(sf);
        return skillNames.some(sn => sn.includes(sfStem) || sfStem.includes(sn.substring(0, 3)));
      });
      if (!hasMatch) continue;
    }

    results.push({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      title: user.title || null,
      experience_years: user.experience_years || null,
      education_level: user.education_level || null,
      bio: user.bio || null,
      profile_picture: user.profile_picture || null,
      cv_filename: user.cv_filename || null,
      skills: userSkills,
      total_skills: userSkills.length,
    });
  }

  return res.json({ results, total, limit: lim, offset: off });
});

/**
 * GET /api/talent/best/:jobId
 * Top 10 best-matching candidates for a specific job, with optional filters.
 */
router.get('/best/:jobId', (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const { q, skills, education } = req.query;

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  // Verify ownership (unless admin)
  if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
    return res.status(403).json({ detail: 'You can only view candidates for your own jobs' });
  }

  // Load job skills
  const jobSkills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, js.importance
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = ?
  `).all(jobId);

  const jobWithSkills = { ...job, is_active: Boolean(job.is_active), skills: jobSkills };

  // Build candidate filter
  let whereClauses = ["u.role = 'searcher'", "u.status = 'active'"];
  let params = [];

  if (q) {
    const stem = extractStem(q);
    whereClauses.push('(u.title LIKE ? OR u.full_name LIKE ?)');
    params.push(`%${stem}%`, `%${stem}%`);
  }

  if (education) {
    const eduStem = extractStem(education);
    const eduUpper = education.toUpperCase().trim();
    const degreeMap = {
      'MSC': ['master', 'msc', 'ms'],
      'MBA': ['master', 'mba', 'business'],
      'BSC': ['bachelor', 'bsc', 'bs'],
      'PHD': ['doctor', 'phd', 'ph.d'],
      'MASTER': ['master', 'msc', 'ms', 'mba'],
      'BACHELOR': ['bachelor', 'bsc', 'bs', 'ba'],
      'DOCTORATE': ['doctor', 'phd', 'ph.d'],
    };
    const mapped = degreeMap[eduUpper] || [eduStem];
    const eduConditions = mapped.map(() => 'u.education_level LIKE ?').join(' OR ');
    whereClauses.push(`(${eduConditions})`);
    mapped.forEach(v => params.push(`%${v}%`));
  }

  const whereSQL = whereClauses.join(' AND ');

  // Get all matching candidates
  const candidateRows = db.prepare(`
    SELECT DISTINCT u.id, u.full_name, u.email, u.title, u.experience_years,
           u.education_level, u.cv_filename, u.bio, u.profile_picture
    FROM users u
    INNER JOIN user_skills us ON us.user_id = u.id
    WHERE ${whereSQL}
  `).all(...params);

  // Skill filter stems
  let skillFilterStems = null;
  if (skills) {
    skillFilterStems = skills.split(',').map(s => extractStem(s.trim())).filter(Boolean);
  }

  const matches = [];

  for (const row of candidateRows) {
    const userSkills = db.prepare(`
      SELECT s.name AS skill_name, s.category AS skill_category, us.proficiency
      FROM user_skills us
      JOIN skills s ON s.id = us.skill_id
      WHERE us.user_id = ?
    `).all(row.id);

    const skillNames = userSkills.map(s => s.skill_name);
    const skillNamesLower = skillNames.map(s => s.toLowerCase());

    // Apply skill filter
    if (skillFilterStems && skillFilterStems.length > 0) {
      const hasMatch = skillFilterStems.some(sf =>
        skillNamesLower.some(sn => sn.includes(sf) || sf.includes(sn.substring(0, 3)))
      );
      if (!hasMatch) continue;
    }

    const userSkillsSet = new Set(skillNames);
    const { score, matchedSkills, missingSkills, experienceFit } = calculateMatchScore(
      userSkillsSet, row.experience_years, jobWithSkills
    );

    matches.push({
      user_id: row.id,
      full_name: row.full_name,
      email: row.email,
      title: row.title || null,
      experience_years: row.experience_years || null,
      education_level: row.education_level || null,
      bio: row.bio || null,
      profile_picture: row.profile_picture || null,
      score,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      experience_fit: experienceFit,
      total_skills: skillNames.length,
      skills: userSkills,
    });
  }

  // Sort by score descending, take top 10
  matches.sort((a, b) => b.score - a.score);
  const top10 = matches.slice(0, 10);

  return res.json({
    job_title: job.title,
    job_company: job.company,
    candidates: top10,
    total_candidates_analyzed: candidateRows.length,
  });
});

/**
 * POST /api/talent/contact/:userId
 * Employer contacts a candidate — creates a notification for the candidate.
 */
router.post('/contact/:userId', (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  const { message, subject } = req.body;

  const candidate = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(targetUserId, 'searcher');
  if (!candidate) return res.status(404).json({ detail: 'Candidate not found' });

  const employer = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  // Create notification for the candidate
  const notifTitle = `${employer.full_name || 'An employer'} wants to connect`;
  const notifMessage = message
    ? `"${message.substring(0, 200)}"`
    : `${employer.company_name || employer.full_name || 'An employer'} is interested in your profile.`;

  db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, metadata, is_read, created_at)
    VALUES (?, 'employer_contact', ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(
    targetUserId,
    notifTitle,
    notifMessage,
    JSON.stringify({
      employer_id: req.user.id,
      employer_name: employer.full_name,
      employer_email: employer.email,
      employer_company: employer.company_name,
      employer_type: employer.employer_type,
      employer_profile_picture: employer.profile_picture,
      subject: subject || null,
    })
  );

  return res.json({ message: 'Candidate has been notified', candidate_email: candidate.email });
});

module.exports = router;
