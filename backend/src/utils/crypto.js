const bcrypt = require('bcrypt');

async function hashPassword(plain) {
  const saltRounds = 12;
  return bcrypt.hash(plain, saltRounds);
}

async function verifyPassword(plain, passwordHash) {
  return bcrypt.compare(plain, passwordHash);
}

async function hashToken(token) {
  const saltRounds = 10;
  return bcrypt.hash(token, saltRounds);
}

async function verifyTokenHash(token, tokenHash) {
  if (!tokenHash) return false;
  return bcrypt.compare(token, tokenHash);
}

module.exports = { hashPassword, verifyPassword, hashToken, verifyTokenHash };

