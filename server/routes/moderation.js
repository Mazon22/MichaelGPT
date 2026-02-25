const express = require('express');
const { requireRole } = require('../middleware/roles');
const { isOnlineByMs } = require('../services/onlineStatus');

function canModerate(role) {
  return role === 'moderator' || role === 'owner';
}

function parseBool(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
}

function createModerationRouter(db) {
  const router = express.Router();

  async function logAction(actorId, action, targetUserId, details = null) {
    await db.run(
      'INSERT INTO moderator_audit_logs (actor_id, action, target_user_id, details) VALUES (?, ?, ?, ?)',
      [actorId, action, targetUserId || null, details ? JSON.stringify(details) : null]
    );
  }

  router.get('/users', requireRole(['moderator', 'owner']), async (req, res, next) => {
    try {
      const users = await db.all(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.role,
           u.is_verified AS isVerified,
           u.created_at AS createdAt,
           u.avatar_url AS avatarUrl,
           CAST(strftime('%s', u.last_seen_at) AS INTEGER) * 1000 AS lastSeenAtMs,
           (
             SELECT COUNT(*)
             FROM chats c
             JOIN messages m ON m.chat_id = c.id AND m.role = 'user'
             WHERE c.user_id = u.id
           ) AS totalMessages,
           b.id AS activeBanId,
           b.reason AS banReason,
           b.created_at AS bannedAt,
           bm.name AS bannedByName
         FROM users u
         LEFT JOIN user_bans b
           ON b.user_id = u.id
          AND b.revoked_at IS NULL
         LEFT JOIN users bm
           ON bm.id = b.banned_by
         ORDER BY u.id DESC`
      );
      const nowMs = Date.now();
      const normalized = users.map((user) => {
        const lastSeenAtMs = Number.isFinite(user.lastSeenAtMs) ? user.lastSeenAtMs : null;
        return {
          ...user,
          lastSeenAtMs,
          isOnline: isOnlineByMs(lastSeenAtMs, nowMs),
        };
      });
      return res.json({ users: normalized });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/users/:id/profile', requireRole(['moderator', 'owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }

      const user = await db.get(
        `SELECT id, name, email, role, is_verified AS isVerified, avatar_url AS avatarUrl, created_at AS createdAt,
                CAST(strftime('%s', last_seen_at) AS INTEGER) * 1000 AS lastSeenAtMs
         FROM users
         WHERE id = ?`,
        [targetId]
      );
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const stats = await db.get(
        `SELECT
           COUNT(m.id) AS totalMessages
         FROM users u
         LEFT JOIN chats c ON c.user_id = u.id
         LEFT JOIN messages m ON m.chat_id = c.id AND m.role = 'user'
         WHERE u.id = ?`,
        [targetId]
      );

      const lastSeenAtMs = Number.isFinite(user.lastSeenAtMs) ? user.lastSeenAtMs : null;
      return res.json({
        user: {
          ...user,
          lastSeenAtMs,
          isOnline: isOnlineByMs(lastSeenAtMs, Date.now()),
        },
        stats: {
          totalMessages: stats?.totalMessages || 0,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/users/:id/verify', requireRole(['owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const verified = parseBool(req.body?.verified);

      if (!Number.isInteger(targetId) || targetId <= 0 || verified === null) {
        return res.status(400).json({ error: 'Некорректные данные' });
      }

      const target = await db.get('SELECT id, name, role FROM users WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      await db.run('UPDATE users SET is_verified = ? WHERE id = ?', [verified ? 1 : 0, targetId]);
      await logAction(req.user.id, verified ? 'verify_user' : 'unverify_user', targetId, {
        targetName: target.name,
      });

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/users/:id/role', requireRole(['owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const role = String(req.body?.role || '').trim();
      const allowedRoles = ['user', 'moderator'];

      if (!Number.isInteger(targetId) || targetId <= 0 || !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Некорректные данные' });
      }

      const target = await db.get('SELECT id, name, role FROM users WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      if (target.role === 'owner') {
        return res.status(400).json({ error: 'Нельзя менять роль владельца' });
      }

      await db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);
      await logAction(req.user.id, 'set_role', targetId, { from: target.role, to: role, targetName: target.name });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/users/:id/ban', requireRole(['moderator', 'owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const reason = String(req.body?.reason || '').trim().slice(0, 500);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }
      if (targetId === req.user.id) {
        return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
      }

      const target = await db.get('SELECT id, name, role FROM users WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      if (target.role === 'owner') {
        return res.status(400).json({ error: 'Нельзя заблокировать владельца' });
      }
      if (target.role === 'moderator' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Только владелец может блокировать модераторов' });
      }

      const activeBan = await db.get(
        'SELECT id FROM user_bans WHERE user_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1',
        [targetId]
      );
      if (activeBan) {
        return res.status(400).json({ error: 'Пользователь уже заблокирован' });
      }

      await db.run('INSERT INTO user_bans (user_id, banned_by, reason) VALUES (?, ?, ?)', [
        targetId,
        req.user.id,
        reason || null,
      ]);

      await logAction(req.user.id, 'ban_user', targetId, {
        targetName: target.name,
        reason: reason || null,
      });

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/users/:id/unban', requireRole(['moderator', 'owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }

      const activeBan = await db.get(
        'SELECT id FROM user_bans WHERE user_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1',
        [targetId]
      );
      if (!activeBan) {
        return res.status(400).json({ error: 'Пользователь не заблокирован' });
      }

      await db.run(
        `UPDATE user_bans
         SET revoked_at = CURRENT_TIMESTAMP,
             revoked_by = ?
         WHERE id = ?`,
        [req.user.id, activeBan.id]
      );

      await logAction(req.user.id, 'unban_user', targetId);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/users/:id', requireRole(['owner']), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }
      if (targetId === req.user.id) {
        return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
      }

      const target = await db.get('SELECT id, name, role FROM users WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      if (target.role === 'owner') {
        return res.status(400).json({ error: 'Нельзя удалить владельца' });
      }

      await db.run('DELETE FROM users WHERE id = ?', [targetId]);
      await logAction(req.user.id, 'delete_account', null, {
        targetId,
        targetName: target.name,
      });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/audit', requireRole(['moderator', 'owner']), async (req, res, next) => {
    try {
      const logs = await db.all(
        `SELECT
           l.id,
           l.action,
           l.target_user_id AS targetUserId,
           l.details,
           l.created_at AS createdAt,
           a.name AS actorName,
           a.role AS actorRole,
           t.name AS targetUserName
         FROM moderator_audit_logs l
         JOIN users a ON a.id = l.actor_id
         LEFT JOIN users t ON t.id = l.target_user_id
         ORDER BY l.id DESC
         LIMIT 300`
      );

      const normalized = logs.map((log) => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      }));

      return res.json({ logs: normalized });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createModerationRouter;
