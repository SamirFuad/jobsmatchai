const { db } = require('../database');
const { decodeAccessToken } = require('../services/authService');

/**
 * Express middleware: extract Bearer token, decode JWT, attach req.user.
 * Also blocks suspended users.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const payload = decodeAccessToken(token);

  if (!payload) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }

  const userId = payload.sub;
  if (!userId) {
    return res.status(401).json({ detail: 'Token payload missing subject' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(userId, 10));
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }

  // Block suspended users
  if (user.status === 'suspended') {
    return res.status(403).json({ detail: 'Your account has been suspended. Contact an administrator.' });
  }

  req.user = user;
  next();
}

/**
 * Optional auth — attaches req.user if token present, but doesn't block.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = decodeAccessToken(token);
    if (payload && payload.sub) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(payload.sub, 10));
      if (user && user.status !== 'suspended') req.user = user;
    }
  }
  next();
}

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin', 'employer')
 * Must be used AFTER requireAuth.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ detail: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
