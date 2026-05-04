const { Router } = require('express');
const { db } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculateMatchScore } = require('../services/matchingEngine');

const router = Router();

// All employer matching routes require auth + employer/admin role
router.use(requireAuth, requireRole('employer', 'admin'));

/**
 * Helper: load user with their skills for matching.
 */
function loadCandidateWithSkills(userRow) {
  const skills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, us.proficiency
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ?
  `).all(userRow.id);

  return {
    ...userRow,
    skills: skills.map(s => s.skill_name),
    skillDetails: skills,
  };
}

/**
 * Helper: load a job with its skills for matching.
 */
function loadJobWithSkills(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return null;

  const skills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, js.importance
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = ?
  `).all(jobId);

  return { ...job, is_active: Boolean(job.is_active), skills };
}

// GET /api/employer/jobs/:job_id/candidates — ranked list of APPLICANTS only
router.get('/jobs/:job_id/candidates', (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);
  const minScore = parseFloat(req.query.min_score || '0');

  const job = loadJobWithSkills(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  // Verify ownership (unless admin)
  if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
    return res.status(403).json({ detail: 'You can only search candidates for your own jobs' });
  }

  // Get only candidates who have APPLIED to this specific job
  const candidateRows = db.prepare(`
    SELECT DISTINCT u.id, u.full_name, u.email, u.title, u.experience_years,
           u.education_level, u.cv_filename, u.company_name, u.bio,
           u.phone_number, u.profile_picture, u.created_at,
           a.status AS application_status, a.cover_letter, a.created_at AS applied_at
    FROM users u
    INNER JOIN applications a ON a.user_id = u.id AND a.job_id = ?
    WHERE u.role = 'searcher' AND u.status = 'active'
    ORDER BY a.created_at DESC
  `).all(jobId);

  const matches = [];

  for (const candidateRow of candidateRows) {
    const candidate = loadCandidateWithSkills(candidateRow);
    const userSkillsSet = new Set(candidate.skills);

    const { score, matchedSkills, missingSkills, experienceFit } = calculateMatchScore(
      userSkillsSet, candidate.experience_years, job
    );

    if (score >= minScore) {
      matches.push({
        user_id: candidate.id,
        full_name: candidate.full_name,
        email: candidate.email,
        title: candidate.title || null,
        experience_years: candidate.experience_years || null,
        education_level: candidate.education_level || null,
        phone_number: candidateRow.phone_number || null,
        bio: candidateRow.bio || null,
        profile_picture: candidateRow.profile_picture || null,
        application_status: candidateRow.application_status,
        cover_letter: candidateRow.cover_letter || null,
        applied_at: candidateRow.applied_at,
        score,
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        experience_fit: experienceFit,
        total_skills: candidate.skills.length,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return res.json({
    job_title: job.title,
    job_company: job.company,
    candidates: matches,
    total_candidates_analyzed: candidateRows.length,
  });
});

// GET /api/employer/jobs/:job_id/candidates/:user_id/fit — detailed fit report
router.get('/jobs/:job_id/candidates/:user_id/fit', (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);
  const userId = parseInt(req.params.user_id, 10);

  const job = loadJobWithSkills(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
    return res.status(403).json({ detail: 'Access denied' });
  }

  const candidateRow = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(userId, 'searcher');
  if (!candidateRow) return res.status(404).json({ detail: 'Candidate not found' });

  const candidate = loadCandidateWithSkills(candidateRow);
  const userSkillsSet = new Set(candidate.skills);

  const { score, matchedSkills, missingSkills, experienceFit } = calculateMatchScore(
    userSkillsSet, candidate.experience_years, job
  );

  // Separate missing into required vs preferred
  const requiredSkillsSet = new Set();
  const preferredSkillsSet = new Set();

  for (const js of job.skills) {
    const skillLower = js.skill_name.toLowerCase();
    if (js.importance === 'required') {
      requiredSkillsSet.add(skillLower);
    } else {
      preferredSkillsSet.add(skillLower);
    }
  }

  const userLower = new Set(candidate.skills.map(s => s.toLowerCase()));
  const missingRequired = [...requiredSkillsSet]
    .filter(s => !userLower.has(s))
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .sort();
  const missingPreferred = [...preferredSkillsSet]
    .filter(s => !userLower.has(s))
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .sort();

  let recommendation;
  if (score >= 80) recommendation = 'Excellent candidate! Strong alignment with job requirements.';
  else if (score >= 60) recommendation = 'Good candidate with most required skills. Consider for interview.';
  else if (score >= 40) recommendation = 'Partial match. Candidate may need training in key areas.';
  else recommendation = 'Weak match. Candidate lacks significant required skills.';

  return res.json({
    candidate_name: candidate.full_name,
    candidate_email: candidate.email,
    candidate_title: candidate.title,
    job_title: job.title,
    overall_score: score,
    matched_skills: matchedSkills,
    missing_required: missingRequired,
    missing_preferred: missingPreferred,
    experience_fit: experienceFit,
    candidate_experience: candidate.experience_years,
    job_required_experience: job.experience_required,
    recommendation,
  });
});

module.exports = router;
