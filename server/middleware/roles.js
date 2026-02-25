function hasRole(user, roles) {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!hasRole(req.user, roles)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    return next();
  };
}

module.exports = {
  hasRole,
  requireRole,
};
