const { Router } = require('express');
const { db } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/stats — system health overview
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const totalJobs = db.prepare('SELECT COUNT(*) as cnt FROM jobs').get().cnt;
  const activeJobs = db.prepare('SELECT COUNT(*) as cnt FROM jobs WHERE is_active = 1').get().cnt;
  const totalSkills = db.prepare('SELECT COUNT(*) as cnt FROM skills').get().cnt;

  const roleCounts = db.prepare(`
    SELECT role, COUNT(*) as count FROM users GROUP BY role
  `).all();

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM users GROUP BY status
  `).all();

  const recentUsers = db.prepare(`
    SELECT id, email, full_name, role, status, created_at
    FROM users ORDER BY created_at DESC LIMIT 5
  `).all();

  return res.json({
    total_users: totalUsers,
    total_jobs: totalJobs,
    active_jobs: activeJobs,
    total_skills: totalSkills,
    users_by_role: roleCounts.reduce((acc, r) => { acc[r.role] = r.count; return acc; }, {}),
    users_by_status: statusCounts.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
    recent_users: recentUsers,
  });
});

// GET /api/admin/users — list all users with filtering
router.get('/users', (req, res) => {
  const { role, status, search, skip = '0', limit = '50' } = req.query;

  let whereClauses = [];
  let params = [];

  if (role) {
    whereClauses.push('role = ?');
    params.push(role);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  if (search) {
    whereClauses.push('(email LIKE ? OR full_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM users ${whereSQL}`).get(...params).cnt;

  const users = db.prepare(`
    SELECT id, email, full_name, role, status, company_name, title,
           experience_years, education_level, cv_filename, created_at, updated_at
    FROM users ${whereSQL}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), parseInt(skip, 10));

  // Add skill count for each user
  const usersOut = users.map(u => {
    const skillCount = db.prepare('SELECT COUNT(*) as cnt FROM user_skills WHERE user_id = ?').get(u.id).cnt;
    return { ...u, skill_count: skillCount };
  });

  return res.json({ users: usersOut, total });
});

// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) return res.status(404).json({ detail: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ detail: 'Cannot suspend admin accounts' });

  db.prepare("UPDATE users SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
  return res.json({ message: `User ${user.email} suspended`, user_id: userId, status: 'suspended' });
});

// PUT /api/admin/users/:id/activate
router.put('/users/:id/activate', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) return res.status(404).json({ detail: 'User not found' });

  db.prepare("UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
  return res.json({ message: `User ${user.email} activated`, user_id: userId, status: 'active' });
});

// DELETE /api/admin/users/:id — cascading delete
router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!user) return res.status(404).json({ detail: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ detail: 'Cannot delete your own account' });

  const deleteUser = db.transaction(() => {
    db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM job_skills WHERE job_id IN (SELECT id FROM jobs WHERE created_by = ?)').run(userId);
    db.prepare('DELETE FROM jobs WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  deleteUser();
  return res.json({ message: `User ${user.email} and all associated data deleted` });
});

// GET /api/admin/jobs — view all jobs regardless of creator
router.get('/jobs', (req, res) => {
  const { search, is_active, skip = '0', limit = '50' } = req.query;

  let whereClauses = [];
  let params = [];

  if (is_active !== undefined) {
    whereClauses.push('j.is_active = ?');
    params.push(is_active === 'true' ? 1 : 0);
  }
  if (search) {
    whereClauses.push('(j.title LIKE ? OR j.company LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM jobs j ${whereSQL}`).get(...params).cnt;

  const jobs = db.prepare(`
    SELECT j.*, u.email as creator_email, u.full_name as creator_name
    FROM jobs j
    LEFT JOIN users u ON u.id = j.created_by
    ${whereSQL}
    ORDER BY j.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), parseInt(skip, 10));

  return res.json({ jobs, total });
});

// DELETE /api/admin/jobs/:id — admin can delete any job
router.delete('/jobs/:id', (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  db.prepare('DELETE FROM job_skills WHERE job_id = ?').run(jobId);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
  return res.json({ message: `Job "${job.title}" deleted` });
});

module.exports = router;
