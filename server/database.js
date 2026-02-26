const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'michaelgpt.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function initDatabase() {
  async function safeExec(sql) {
    try {
      await exec(sql);
    } catch (error) {
      const duplicateColumn = String(error.message || '').includes('duplicate column name');
      if (!duplicateColumn) throw error;
    }
  }

  await exec('PRAGMA foreign_keys = ON;');
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_verified INTEGER NOT NULL DEFAULT 0,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT DEFAULT 'Новый чат',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_xp_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      xp_amount INTEGER NOT NULL DEFAULT 15,
      source TEXT NOT NULL DEFAULT 'message',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS global_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      banned_by INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      revoked_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS moderator_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_user_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_users_name_nocase ON users(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_global_messages_created ON global_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_global_messages_user_id ON global_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans(user_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_moderator_audit_actor ON moderator_audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_moderator_audit_created ON moderator_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_xp_logs_user_id ON user_xp_logs(user_id);
  `);

  await safeExec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';`);
  await safeExec(`ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;`);
  await safeExec(`ALTER TABLE users ADD COLUMN last_seen_at DATETIME;`);
  await safeExec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
  await run(
    `UPDATE users
     SET last_seen_at = CURRENT_TIMESTAMP
     WHERE last_seen_at IS NULL`
  );

  await run(
    `UPDATE users
     SET role = 'owner'
     WHERE LOWER(name) = 'michael'
       AND role <> 'owner'`
  );
}

module.exports = {
  db,
  dbPath,
  run,
  get,
  all,
  exec,
  initDatabase,
};
