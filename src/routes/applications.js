const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /api/applications — Searcher applies to a job
router.post('/', requireAuth, requireRole('searcher'), (req, res) => {
  const { job_id, cover_letter } = req.body;
  const userId = req.user.id;

  if (!job_id) {
    return res.status(400).json({ detail: 'job_id is required' });
  }

  try {
    // Check job exists and is active
    const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND is_active = 1').get(job_id);
    if (!job) {
      return res.status(404).json({ detail: 'Job not found or no longer active' });
    }

    // Check if already applied
    const existing = db.prepare('SELECT id FROM applications WHERE job_id = ? AND user_id = ?').get(job_id, userId);
    if (existing) {
      return res.status(409).json({ detail: 'You have already applied to this job' });
    }

    // Create application
    const result = db.prepare(
      'INSERT INTO applications (job_id, user_id, cover_letter) VALUES (?, ?, ?)'
    ).run(job_id, userId, cover_letter || null);

    // Get applicant info for the notification
    const applicant = db.prepare(`
      SELECT id, full_name, email, phone_number, title, experience_years, 
             education_level, company_name, bio, profile_picture, cv_filename
      FROM users WHERE id = ?
    `).get(userId);

    // Get applicant skills
    const skills = db.prepare(`
      SELECT s.name as skill_name, us.proficiency
      FROM user_skills us
      JOIN skills s ON s.id = us.skill_id
      WHERE us.user_id = ?
    `).all(userId);

    // Create notification for the employer (job creator)
    if (job.created_by) {
      const metadata = JSON.stringify({
        application_id: result.lastInsertRowid,
        job_id: job.id,
        job_title: job.title,
        applicant: {
          id: applicant.id,
          full_name: applicant.full_name,
          email: applicant.email,
          phone_number: applicant.phone_number,
          title: applicant.title,
          experience_years: applicant.experience_years,
          education_level: applicant.education_level,
          company_name: applicant.company_name,
          bio: applicant.bio,
          profile_picture: applicant.profile_picture,
          cv_filename: applicant.cv_filename,
          skills: skills,
          cover_letter: cover_letter || null
        }
      });

      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES (?, 'application', ?, ?, ?)
      `).run(
        job.created_by,
        `New Application: ${job.title}`,
        `${applicant.full_name} has applied to your "${job.title}" position`,
        metadata
      );
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      job_id,
      user_id: userId,
      status: 'pending',
      message: 'Application submitted successfully'
    });
  } catch (err) {
    console.error('Application error:', err);
    res.status(500).json({ detail: 'Failed to submit application' });
  }
});

// GET /api/applications/my — Searcher sees their applications
router.get('/my', requireAuth, (req, res) => {
  try {
    const apps = db.prepare(`
      SELECT a.*, j.title as job_title, j.company as job_company, j.location as job_location,
             j.job_type, j.salary_min, j.salary_max
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.id);

    res.json(apps);
  } catch (err) {
    console.error('Fetch applications error:', err);
    res.status(500).json({ detail: 'Failed to fetch applications' });
  }
});

// GET /api/applications/job/:jobId — Employer sees applications for their job
router.get('/job/:jobId', requireAuth, requireRole('employer', 'admin'), (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);

  try {
    // Verify employer owns the job (or is admin)
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ detail: 'Job not found' });

    if (req.user.role !== 'admin' && job.created_by !== req.user.id) {
      return res.status(403).json({ detail: 'You can only view applications for your own jobs' });
    }

    const apps = db.prepare(`
      SELECT a.*, 
             u.full_name, u.email, u.phone_number, u.title as user_title,
             u.experience_years, u.education_level, u.company_name, u.bio,
             u.profile_picture, u.cv_filename
      FROM applications a
      JOIN users u ON u.id = a.user_id
      WHERE a.job_id = ?
      ORDER BY a.created_at DESC
    `).all(jobId);

    // Attach skills for each applicant
    const result = apps.map(app => {
      const skills = db.prepare(`
        SELECT s.name as skill_name, us.proficiency
        FROM user_skills us
        JOIN skills s ON s.id = us.skill_id
        WHERE us.user_id = ?
      `).all(app.user_id);

      return { ...app, skills };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch job applications error:', err);
    res.status(500).json({ detail: 'Failed to fetch applications' });
  }
});

// PUT /api/applications/:id/status — Employer updates application status
router.put('/:id/status', requireAuth, requireRole('employer', 'admin'), (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!['pending', 'reviewing', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status. Must be: pending, reviewing, accepted, or rejected' });
  }

  try {
    const app = db.prepare(`
      SELECT a.*, j.created_by, j.title as job_title
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = ?
    `).get(appId);

    if (!app) return res.status(404).json({ detail: 'Application not found' });
    if (req.user.role !== 'admin' && app.created_by !== req.user.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }

    db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, appId);

    // Notify the applicant of status change
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (?, 'status_update', ?, ?, ?)
    `).run(
      app.user_id,
      `Application ${status}: ${app.job_title}`,
      `Your application for "${app.job_title}" has been ${status}`,
      JSON.stringify({ application_id: appId, job_title: app.job_title, new_status: status })
    );

    res.json({ message: `Application status updated to ${status}` });
  } catch (err) {
    console.error('Update application status error:', err);
    res.status(500).json({ detail: 'Failed to update application status' });
  }
});

module.exports = router;
