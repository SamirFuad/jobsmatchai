const { Router } = require('express');
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { matchUserToJobs, getSkillGapReport } = require('../services/matchingEngine');

const router = Router();

/**
 * Helper: load a job with its skills for the matching engine.
 */
function loadJobWithSkills(jobRow) {
  const skills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, js.importance
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = ?
  `).all(jobRow.id);

  return { ...jobRow, is_active: Boolean(jobRow.is_active), skills };
}

/**
 * Helper: load user skills as plain name array.
 */
function getUserSkillNames(userId) {
  const rows = db.prepare(`
    SELECT s.name
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ?
  `).all(userId);
  return rows.map((r) => r.name);
}

// GET /api/matching/jobs
router.get('/jobs', requireAuth, (req, res) => {
  const minScore = parseFloat(req.query.min_score || '0');
  const userId = req.user.id;

  // Get user with fresh data
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const userSkills = getUserSkillNames(userId);

  if (userSkills.length === 0) {
    return res.status(400).json({ detail: 'No skills found. Please upload your CV first.' });
  }

  // Get all active jobs with skills
  const jobRows = db.prepare('SELECT * FROM jobs WHERE is_active = 1').all();
  const jobs = jobRows.map(loadJobWithSkills);

  if (jobs.length === 0) {
    return res.json({ matches: [], total_jobs_analyzed: 0, skill_suggestions: [] });
  }

  const result = matchUserToJobs(userSkills, user.experience_years, jobs, minScore);
  return res.json(result);
});

// GET /api/matching/jobs/:job_id/fit
router.get('/jobs/:job_id/fit', requireAuth, (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);
  const userId = req.user.id;

  const jobRow = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!jobRow) return res.status(404).json({ detail: 'Job not found' });

  const job = loadJobWithSkills(jobRow);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const userSkills = getUserSkillNames(userId);

  const report = getSkillGapReport(userSkills, user.experience_years, job);
  return res.json(report);
});

// GET /api/matching/skills/suggestions
router.get('/skills/suggestions', requireAuth, (req, res) => {
  const topN = parseInt(req.query.top_n || '10', 10);
  const userId = req.user.id;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const userSkills = getUserSkillNames(userId);

  if (userSkills.length === 0) {
    return res.status(400).json({ detail: 'No skills found. Upload CV first.' });
  }

  const jobRows = db.prepare('SELECT * FROM jobs WHERE is_active = 1').all();
  const jobs = jobRows.map(loadJobWithSkills);

  if (jobs.length === 0) {
    return res.json({ suggestions: [], message: 'No jobs available for analysis' });
  }

  const matchingResult = matchUserToJobs(userSkills, user.experience_years, jobs);
  const suggestions = matchingResult.skill_suggestions.slice(0, topN);

  return res.json({
    total_jobs_analyzed: matchingResult.total_jobs_analyzed,
    your_skill_count: userSkills.length,
    suggestions,
  });
});

module.exports = router;
