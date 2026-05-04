const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  DATABASE_PATH: process.env.DATABASE_PATH || './smart_jobs.db',
  SECRET_KEY: process.env.SECRET_KEY || 'super-secret-key-change-in-production',
  ALGORITHM: process.env.ALGORITHM || 'HS256',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '1440', 10),
  PORT: parseInt(process.env.PORT || '8000', 10),

  APP_TITLE: 'Smart Job Matching Platform',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'AI-powered job matching with CV parsing and smart recommendations',

  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  UPLOAD_DIR: path.resolve(__dirname, '..', 'uploads'),
};

module.exports = config;
