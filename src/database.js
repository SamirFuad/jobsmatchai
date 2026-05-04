const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

// Resolve database path relative to project root
const dbPath = path.resolve(__dirname, '..', config.DATABASE_PATH);
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Create all tables if they don't already exist.
 * Schema supports role-based access: admin, employer, searcher.
 */
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      hashed_password VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'searcher',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      company_name VARCHAR(255),
      employer_type VARCHAR(20),
      phone_number VARCHAR(50),
      bio TEXT,
      profile_picture TEXT,
      title VARCHAR(255),
      experience_years INTEGER,
      education_level VARCHAR(100),
      cv_text TEXT,
      cv_filename VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      company VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      location VARCHAR(255),
      job_type VARCHAR(50),
      employment_type VARCHAR(50) DEFAULT 'permanent',
      worker_type VARCHAR(50) DEFAULT 'staff',
      duration_min INTEGER,
      duration_max INTEGER,
      salary_min REAL,
      salary_max REAL,
      experience_required INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_jobs_title ON jobs(title);

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(50) NOT NULL DEFAULT 'general'
    );

    CREATE INDEX IF NOT EXISTS ix_skills_name ON skills(name);

    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      proficiency VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS job_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      importance VARCHAR(50) NOT NULL DEFAULT 'required'
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cover_letter TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(job_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS ix_applications_job ON applications(job_id);
    CREATE INDEX IF NOT EXISTS ix_applications_user ON applications(user_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL DEFAULT 'application',
      title VARCHAR(255) NOT NULL,
      message TEXT,
      metadata TEXT,
      is_read BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id);
  `);

  // --- Migrations for existing databases ---
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  const userColNames = new Set(userCols.map((c) => c.name));

  if (!userColNames.has('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'searcher'");
    console.log('  Migration: added role column to users table');
  }
  if (!userColNames.has('status')) {
    db.exec("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'");
    console.log('  Migration: added status column to users table');
  }
  if (!userColNames.has('company_name')) {
    db.exec('ALTER TABLE users ADD COLUMN company_name VARCHAR(255)');
    console.log('  Migration: added company_name column to users table');
  }
  if (!userColNames.has('phone_number')) {
    db.exec('ALTER TABLE users ADD COLUMN phone_number VARCHAR(50)');
    console.log('  Migration: added phone_number column to users table');
  }
  if (!userColNames.has('bio')) {
    db.exec('ALTER TABLE users ADD COLUMN bio TEXT');
    console.log('  Migration: added bio column to users table');
  }
  if (!userColNames.has('profile_picture')) {
    db.exec('ALTER TABLE users ADD COLUMN profile_picture TEXT');
    console.log('  Migration: added profile_picture column to users table');
  }

  if (!userColNames.has('employer_type')) {
    db.exec('ALTER TABLE users ADD COLUMN employer_type VARCHAR(20)');
    console.log('  Migration: added employer_type column to users table');
  }

  const jobCols = db.prepare("PRAGMA table_info(jobs)").all();
  const jobColNames = new Set(jobCols.map((c) => c.name));

  if (!jobColNames.has('created_by')) {
    db.exec('ALTER TABLE jobs ADD COLUMN created_by INTEGER REFERENCES users(id)');
    console.log('  Migration: added created_by column to jobs table');
  }
  if (!jobColNames.has('employment_type')) {
    db.exec("ALTER TABLE jobs ADD COLUMN employment_type VARCHAR(50) DEFAULT 'permanent'");
    console.log('  Migration: added employment_type column to jobs table');
  }
  if (!jobColNames.has('worker_type')) {
    db.exec("ALTER TABLE jobs ADD COLUMN worker_type VARCHAR(50) DEFAULT 'staff'");
    console.log('  Migration: added worker_type column to jobs table');
  }
  if (!jobColNames.has('duration_min')) {
    db.exec('ALTER TABLE jobs ADD COLUMN duration_min INTEGER');
    console.log('  Migration: added duration_min column to jobs table');
  }
  if (!jobColNames.has('duration_max')) {
    db.exec('ALTER TABLE jobs ADD COLUMN duration_max INTEGER');
    console.log('  Migration: added duration_max column to jobs table');
  }
}

module.exports = { db, initDb };
