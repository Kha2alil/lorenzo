const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment');
}
const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  const authHeader = req.headers['authorization'];

  if (key && key === process.env.ADMIN_API_KEY) {
    return next();
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAuth, JWT_SECRET };