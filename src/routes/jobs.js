const { Router } = require('express');
const { db } = require('../database');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { getAllSkillsFlat } = require('../services/nlpEngine');

const router = Router();

/**
 * Helper: get or create skill by name.
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

/**
 * Helper: build job response with skills.
 */
function getJobWithSkills(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return null;

  const skills = db.prepare(`
    SELECT s.name AS skill_name, s.category AS skill_category, js.importance
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = ?
  `).all(jobId);

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location || null,
    job_type: job.job_type || null,
    employment_type: job.employment_type || 'permanent',
    worker_type: job.worker_type || 'staff',
    duration_min: job.duration_min || null,
    duration_max: job.duration_max || null,
    salary_min: job.salary_min || null,
    salary_max: job.salary_max || null,
    experience_required: job.experience_required,
    is_active: Boolean(job.is_active),
    created_by: job.created_by || null,
    created_at: job.created_at,
    skills,
  };
}

// POST /api/jobs/ — only employers and admins can create
router.post('/', requireAuth, requireRole('employer', 'admin'), (req, res) => {
  const { title, company, description, location, job_type, employment_type, worker_type, duration_min, duration_max, salary_min, salary_max, experience_required, skills } = req.body;

  if (!title || !company || !description) {
    return res.status(422).json({ detail: 'title, company, and description are required' });
  }

  if (salary_min != null && salary_max != null && salary_max < salary_min) {
    return res.status(422).json({ detail: 'salary_max cannot be less than salary_min' });
  }

  try {
    const createJob = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO jobs (title, company, description, location, job_type, employment_type, worker_type, duration_min, duration_max, salary_min, salary_max, experience_required, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        title, company, description,
        location || null, job_type || null,
        employment_type || 'permanent',
        worker_type || 'staff',
        duration_min || null, duration_max || null,
        salary_min || null, salary_max || null,
        experience_required || 0,
        req.user.id
      );

      const jobId = result.lastInsertRowid;

      if (skills && Array.isArray(skills)) {
        const insertJobSkill = db.prepare('INSERT INTO job_skills (job_id, skill_id, importance) VALUES (?, ?, ?)');
        for (const skillData of skills) {
          const skill = getOrCreateSkill(skillData.name);
          insertJobSkill.run(jobId, skill.id, skillData.importance || 'required');
        }
      }

      return jobId;
    });

    const jobId = createJob();
    const jobOut = getJobWithSkills(jobId);
    return res.status(201).json(jobOut);
  } catch (err) {
    console.error('Job creation error:', err);
    return res.status(500).json({ detail: 'Failed to create job' });
  }
});

// GET /api/jobs/
router.get('/', (req, res) => {
  const { skip = '0', limit = '20', search, location, min_salary, is_active = 'true' } = req.query;

  let whereClauses = ['j.is_active = ?'];
  let params = [is_active === 'true' ? 1 : 0];

  if (search) {
    whereClauses.push('(j.title LIKE ? OR j.company LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (location) {
    whereClauses.push('j.location LIKE ?');
    params.push(`%${location}%`);
  }
  if (min_salary) {
    whereClauses.push('j.salary_min >= ?');
    params.push(parseFloat(min_salary));
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM jobs j ${whereSQL}`).get(...params).cnt;

  const jobs = db.prepare(`
    SELECT * FROM jobs j ${whereSQL}
    ORDER BY j.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), parseInt(skip, 10));

  const jobsOut = jobs.map((job) => getJobWithSkills(job.id));

  return res.json({ jobs: jobsOut, total });
});

// GET /api/jobs/:job_id
router.get('/:job_id', (req, res) => {
  const jobOut = getJobWithSkills(parseInt(req.params.job_id, 10));
  if (!jobOut) return res.status(404).json({ detail: 'Job not found' });
  return res.json(jobOut);
});

// PUT /api/jobs/:job_id — only the creator can edit
router.put('/:job_id', requireAuth, (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  // Ownership check: only the creator or admin can edit
  if (req.user.role !== 'admin' && job.created_by && job.created_by !== req.user.id) {
    return res.status(403).json({ detail: 'You can only edit jobs you created' });
  }

  const { title, company, description, location, job_type, employment_type, worker_type, duration_min, duration_max, salary_min, salary_max, experience_required, is_active, skills } = req.body;

  try {
    const updateJob = db.transaction(() => {
      const fields = [];
      const values = [];

      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (company !== undefined) { fields.push('company = ?'); values.push(company); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (location !== undefined) { fields.push('location = ?'); values.push(location); }
      if (job_type !== undefined) { fields.push('job_type = ?'); values.push(job_type); }
      if (employment_type !== undefined) { fields.push('employment_type = ?'); values.push(employment_type); }
      if (worker_type !== undefined) { fields.push('worker_type = ?'); values.push(worker_type); }
      if (duration_min !== undefined) { fields.push('duration_min = ?'); values.push(duration_min); }
      if (duration_max !== undefined) { fields.push('duration_max = ?'); values.push(duration_max); }
      if (salary_min !== undefined) { fields.push('salary_min = ?'); values.push(salary_min); }
      if (salary_max !== undefined) { fields.push('salary_max = ?'); values.push(salary_max); }
      if (experience_required !== undefined) { fields.push('experience_required = ?'); values.push(experience_required); }
      if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

      if (fields.length > 0) {
        values.push(jobId);
        db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      if (skills !== undefined && Array.isArray(skills)) {
        db.prepare('DELETE FROM job_skills WHERE job_id = ?').run(jobId);
        const insertJobSkill = db.prepare('INSERT INTO job_skills (job_id, skill_id, importance) VALUES (?, ?, ?)');
        for (const skillData of skills) {
          const skill = getOrCreateSkill(skillData.name);
          insertJobSkill.run(jobId, skill.id, skillData.importance || 'required');
        }
      }
    });

    updateJob();
    const jobOut = getJobWithSkills(jobId);
    return res.json(jobOut);
  } catch (err) {
    console.error('Job update error:', err);
    return res.status(500).json({ detail: 'Failed to update job' });
  }
});

// DELETE /api/jobs/:job_id — only the creator can delete
router.delete('/:job_id', requireAuth, (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  if (req.user.role !== 'admin' && job.created_by && job.created_by !== req.user.id) {
    return res.status(403).json({ detail: 'You can only delete jobs you created' });
  }

  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
  return res.status(204).send();
});

module.exports = { router, getJobWithSkills };
