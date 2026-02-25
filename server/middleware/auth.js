const jwt = require('jsonwebtoken');
const db = require('../database');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.get(
      'SELECT id, email, name, role, is_verified AS isVerified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    try {
      await db.run('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    } catch (error) {
      console.error('Failed to update last_seen_at:', error.message);
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
}

module.exports = authMiddleware;
