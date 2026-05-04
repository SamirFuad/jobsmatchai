const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt.
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
function verifyPassword(plainPassword, hashedPassword) {
  try {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  } catch {
    return false;
  }
}

/**
 * Create a JWT access token.
 */
function createAccessToken(payload) {
  return jwt.sign(payload, config.SECRET_KEY, {
    algorithm: config.ALGORITHM,
    expiresIn: `${config.ACCESS_TOKEN_EXPIRE_MINUTES}m`,
  });
}

/**
 * Decode and verify a JWT access token. Returns payload or null.
 */
function decodeAccessToken(token) {
  try {
    return jwt.verify(token, config.SECRET_KEY, {
      algorithms: [config.ALGORITHM],
    });
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, createAccessToken, decodeAccessToken };
