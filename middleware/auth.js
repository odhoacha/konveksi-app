const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'konveksi-secret-2025';

// Verify token and attach user to request
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token required' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

// Role-based access guard
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET };
