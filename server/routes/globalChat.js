const express = require('express');
const { getGlobalChatCooldown } = require('../services/chatPolicies');
const { ONLINE_WINDOW_MINUTES, isOnlineByMs } = require('../services/onlineStatus');

function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseLimit(value, fallback = 60) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return fallback;
  return Math.min(num, 200);
}

function canModerate(role) {
  return role === 'moderator' || role === 'owner';
}

function createGlobalChatRouter(db, authMiddleware) {
  const router = express.Router();

  router.get('/messages', async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 80);

      const messages = await db.all(
        `SELECT *
         FROM (
           SELECT
             gm.id,
             gm.user_id AS userId,
             u.name AS userName,
             u.role AS userRole,
             u.is_verified AS isVerified,
             u.avatar_url AS avatarUrl,
             gm.content,
             CAST(strftime('%s', gm.created_at) AS INTEGER) * 1000 AS createdAtMs
           FROM global_messages gm
           JOIN users u ON u.id = gm.user_id
           ORDER BY gm.id DESC
           LIMIT ?
         ) recent
         ORDER BY id ASC`,
        [limit]
      );

      return res.json({ messages });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/online', async (_req, res, next) => {
    try {
      const cutoff = `-${ONLINE_WINDOW_MINUTES} minutes`;
      const row = await db.get(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE last_seen_at IS NOT NULL
           AND last_seen_at >= datetime('now', ?)`,
        [cutoff]
      );

      return res.json({ count: row?.count || 0, windowMinutes: ONLINE_WINDOW_MINUTES });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/users/:id/profile', async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }

      const user = await db.get(
        `SELECT
           id,
           name,
           role,
           is_verified AS isVerified,
           created_at AS createdAt,
           avatar_url AS avatarUrl,
           CAST(strftime('%s', last_seen_at) AS INTEGER) * 1000 AS lastSeenAtMs
         FROM users
         WHERE id = ?`,
        [userId]
      );
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const stats = await db.get(
        `SELECT
           (SELECT COUNT(*) FROM global_messages gm WHERE gm.user_id = ?) AS globalMessages,
           (SELECT SUM(xp_amount) FROM user_xp_logs WHERE user_id = ? AND source = 'message') AS totalXp,
           (SELECT COUNT(*) FROM user_xp_logs WHERE user_id = ? AND source = 'message') AS totalMessages`,
        [userId, userId, userId]
      );

      const totalMessages = stats?.totalMessages || 0;
      const xp = stats?.totalXp || 0;
      const level = Math.min(Math.floor(xp / 150) + 1, 100);
      const xpForCurrentLevel = (level - 1) * 150;
      const xpProgress = xp - xpForCurrentLevel;
      const xpToNextLevel = level < 100 ? 150 - xpProgress : 0;

      const ranks = {
        1: 'Новичок',
        5: 'Активный',
        10: 'Знающий',
        15: 'Продвинутый',
        20: 'Аналитик',
        25: 'Интеллектуал',
        30: 'Визионер',
        35: 'Лидер',
        40: 'Стратег',
        45: 'Тактик',
        50: 'Элита',
        55: 'Авторитет',
        60: 'Мудрец',
        65: 'Гений',
        70: 'Виртуоз',
        75: 'Титан',
        80: 'Магистр',
        85: 'Феномен',
        90: 'Легенда',
        95: 'Грандмастер',
        100: 'Император',
      };
      const rankThreshold = Math.max(...Object.keys(ranks).map(Number).filter((k) => k <= level));
      const rank = ranks[rankThreshold];

      const rankRow = await db.get(
        `SELECT COUNT(*) + 1 AS worldRank
         FROM (
           SELECT user_id, SUM(xp_amount) AS userXp
           FROM user_xp_logs
           WHERE source = 'message'
           GROUP BY user_id
         ) AS leaderboard
         WHERE leaderboard.userXp > ?`,
        [xp]
      );

      const nowMs = Date.now();
      const lastSeenAtMs = Number.isFinite(user.lastSeenAtMs) ? user.lastSeenAtMs : null;

      return res.json({
        profile: {
          ...user,
          avatarUrl: user.avatarUrl || null,
          lastSeenAtMs,
          isOnline: isOnlineByMs(lastSeenAtMs, nowMs),
          globalMessages: stats?.globalMessages || 0,
          totalMessages: stats?.totalMessages || 0,
          xp,
          level,
          rank,
          xpProgress,
          xpToNextLevel,
          worldRank: rankRow?.worldRank || 1,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me/status', authMiddleware, async (req, res, next) => {
    try {
      const activeBan = await db.get(
        `SELECT
           b.id,
           b.reason,
           b.created_at AS bannedAt,
           m.name AS moderatorName
         FROM user_bans b
         JOIN users m ON m.id = b.banned_by
         WHERE b.user_id = ?
           AND b.revoked_at IS NULL
         ORDER BY b.id DESC
         LIMIT 1`,
        [req.user.id]
      );

      const cooldown = await getGlobalChatCooldown(db, req.user.id, req.user);

      return res.json({
        isBanned: Boolean(activeBan),
        ban: activeBan || null,
        cooldown,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/messages', authMiddleware, async (req, res, next) => {
    try {
      const content = sanitizeText(req.body?.content);

      if (!content) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
      }

      if (content.length > 2000) {
        return res.status(400).json({ error: 'Сообщение слишком длинное (макс. 2000 символов)' });
      }

      const activeBan = await db.get(
        `SELECT
           b.id,
           b.reason,
           m.name AS moderatorName
         FROM user_bans b
         JOIN users m ON m.id = b.banned_by
         WHERE b.user_id = ?
           AND b.revoked_at IS NULL
         ORDER BY b.id DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (activeBan) {
        return res.status(403).json({
          error: `Вы заблокированы модератором ${activeBan.moderatorName}`,
          ban: activeBan,
        });
      }

      const cooldown = await getGlobalChatCooldown(db, req.user.id, req.user);
      if (!cooldown.hasUnlimited && cooldown.remainingMs > 0) {
        return res.status(429).json({
          error: 'Можно писать в глобальный чат не чаще, чем раз в 30 секунд',
          cooldown,
        });
      }

      const insert = await db.run(
        'INSERT INTO global_messages (user_id, content) VALUES (?, ?)',
        [req.user.id, content]
      );

      const message = await db.get(
        `SELECT
           gm.id,
           gm.user_id AS userId,
           u.name AS userName,
           u.role AS userRole,
           u.is_verified AS isVerified,
           u.avatar_url AS avatarUrl,
           gm.content,
           CAST(strftime('%s', gm.created_at) AS INTEGER) * 1000 AS createdAtMs
         FROM global_messages gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.id = ?`,
        [insert.lastID]
      );

      return res.json({ message });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/messages/:id', authMiddleware, async (req, res, next) => {
    try {
      const messageId = Number(req.params.id);
      if (!Number.isInteger(messageId) || messageId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID сообщения' });
      }

      const message = await db.get('SELECT id, user_id AS userId FROM global_messages WHERE id = ?', [messageId]);
      if (!message) {
        return res.status(404).json({ error: 'Сообщение не найдено' });
      }

      const isOwner = message.userId === req.user.id;
      const isModerator = canModerate(req.user.role);
      if (!isOwner && !isModerator) {
        return res.status(403).json({ error: 'Нет доступа к удалению этого сообщения' });
      }

      await db.run('DELETE FROM global_messages WHERE id = ?', [messageId]);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createGlobalChatRouter;
