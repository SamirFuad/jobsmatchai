const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { initDb } = require('./database');

// --- Initialize Database ---
initDb();
console.log('✅ Database initialized');

// --- Ensure uploads directory exists ---
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// --- Create Express App ---
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
const { router: authRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const { router: jobsRouter } = require('./routes/jobs');
const skillsRouter = require('./routes/skills');
const cvRouter = require('./routes/cv');
const matchingRouter = require('./routes/matching');
const adminRouter = require('./routes/admin');
const employerMatchingRouter = require('./routes/employer-matching');
const applicationsRouter = require('./routes/applications');
const notificationsRouter = require('./routes/notifications');
const talentSearchRouter = require('./routes/talent-search');

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/cv', cvRouter);
app.use('/api/matching', matchingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/employer', employerMatchingRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/talent', talentSearchRouter);

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: config.APP_VERSION });
});

// --- Serve Static Frontend ---
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use('/static', express.static(FRONTEND_DIR));
}

// Serve index.html for root route
app.get('/', (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.json({
    message: 'JobsMatch AI Platform API',
    docs: '/health',
  });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ detail: 'Internal server error' });
});

// --- Start Server (local / Docker only — Vercel uses the export) ---
if (!process.env.VERCEL) {
  app.listen(config.PORT, () => {
    console.log(`🚀 ${config.APP_TITLE} v${config.APP_VERSION}`);
    console.log(`   Server running on http://localhost:${config.PORT}`);
    console.log(`   API docs: http://localhost:${config.PORT}/health`);
  });
}

// Export for Vercel serverless
module.exports = app;
