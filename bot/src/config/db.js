const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'bot.sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    config TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS licenses (
    key TEXT PRIMARY KEY,
    tier TEXT NOT NULL,
    duration_days INTEGER,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    redeemed INTEGER NOT NULL DEFAULT 0,
    redeemed_by TEXT,
    guild_id TEXT,
    redeemed_at INTEGER,
    expires_at INTEGER
  );
`);

// SQLite has no "ADD COLUMN IF NOT EXISTS" — added after the table above
// shipped, so existing databases need these guarded ALTER TABLEs instead of
// a CREATE TABLE clause.
for (const alter of ['ALTER TABLE licenses ADD COLUMN price REAL', 'ALTER TABLE licenses ADD COLUMN seats INTEGER NOT NULL DEFAULT 1']) {
  try {
    db.exec(alter);
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) throw error;
  }
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_licenses_guild_id ON licenses(guild_id);

  -- Each row is one server a multi-seat license is currently active in.
  -- Single-seat licenses (the common case) still get exactly one row here —
  -- this table is the single source of truth for "where is this key active",
  -- while licenses.guild_id/redeemed_by/redeemed_at mirror the most recent
  -- seat for backward compatibility with anything reading those directly.
  CREATE TABLE IF NOT EXISTS license_seats (
    license_key TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    redeemed_by TEXT NOT NULL,
    redeemed_at INTEGER NOT NULL,
    PRIMARY KEY (license_key, guild_id)
  );

  CREATE INDEX IF NOT EXISTS idx_license_seats_key ON license_seats(license_key);

  -- A pool of pre-fetched, pre-verified gif/image URLs per category (e.g.
  -- "action:hug", "image:cat"), refreshed in the background on a timer.
  -- Commands read from this instead of calling an API live, so a reaction
  -- command never waits on the network.
  CREATE TABLE IF NOT EXISTS gif_cache (
    category TEXT PRIMARY KEY,
    urls TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Leveling XP lives here rather than inside the guild_config JSON blob.
  -- In the blob, awarding one member XP meant re-serialising and rewriting
  -- every member's XP for that guild on every single message; as its own
  -- table it's a one-row upsert no matter how many ranked members exist.
  CREATE TABLE IF NOT EXISTS guild_xp (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_guild_xp_leaderboard ON guild_xp(guild_id, xp DESC);
`);

// One-time move of any XP still embedded in a guild's config blob into
// guild_xp. Runs once per guild; the blob copy is dropped afterwards so it
// can't drift out of sync with the table.
function migrateEmbeddedXp() {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'xpTableMigrated'").get();
  if (done?.value === '1') return;

  const rows = db.prepare('SELECT guild_id, config FROM guild_config').all();
  const insert = db.prepare('INSERT OR IGNORE INTO guild_xp (guild_id, user_id, xp) VALUES (?, ?, ?)');
  const updateConfig = db.prepare('UPDATE guild_config SET config = ? WHERE guild_id = ?');
  let moved = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      let parsed;
      try {
        parsed = JSON.parse(row.config);
      } catch {
        continue;
      }

      const users = parsed?.leveling?.users;
      if (!users || typeof users !== 'object') continue;

      for (const [userId, data] of Object.entries(users)) {
        const xp = Number(data?.xp);
        if (Number.isFinite(xp) && xp > 0) {
          insert.run(row.guild_id, userId, Math.round(xp));
          moved += 1;
        }
      }

      parsed.leveling.users = {};
      updateConfig.run(JSON.stringify(parsed), row.guild_id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('xpTableMigrated', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  });

  run();
  if (moved > 0) console.log(`Moved ${moved} XP record(s) out of guild configs into the guild_xp table.`);
}

function migrateLegacyGuildConfigs() {
  const legacyDir = path.join(DATA_DIR, 'guilds');
  if (!fs.existsSync(legacyDir)) return;

  const files = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;

  const insert = db.prepare('INSERT OR IGNORE INTO guild_config (guild_id, config, updated_at) VALUES (?, ?, ?)');
  const importAll = db.transaction((entries) => {
    for (const entry of entries) insert.run(entry.guildId, entry.config, Date.now());
  });

  const entries = [];
  for (const file of files) {
    try {
      const guildId = file.replace('.json', '');
      const raw = fs.readFileSync(path.join(legacyDir, file), 'utf8');
      JSON.parse(raw); // validate before importing
      entries.push({ guildId, config: raw });
    } catch (error) {
      console.error(`Skipping unreadable legacy config file ${file}:`, error);
    }
  }

  importAll(entries);
  console.log(`Migrated ${entries.length} guild config file(s) from JSON into SQLite (${DB_PATH}).`);
  fs.renameSync(legacyDir, `${legacyDir}.migrated`);
}

function migrateLegacyGlobalStore() {
  const legacyFile = path.join(DATA_DIR, 'global.json');
  if (!fs.existsSync(legacyFile)) return;

  try {
    const raw = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));

    if (raw.adminGuildId) {
      db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
        'adminGuildId',
        raw.adminGuildId,
      );
    }

    const licenseEntries = Object.entries(raw.licenses ?? {});
    if (licenseEntries.length > 0) {
      const insertLicense = db.prepare(`
        INSERT OR IGNORE INTO licenses (key, tier, duration_days, created_at, created_by, redeemed, redeemed_by, guild_id, redeemed_at, expires_at)
        VALUES (@key, @tier, @durationDays, @createdAt, @createdBy, @redeemed, @redeemedBy, @guildId, @redeemedAt, @expiresAt)
      `);
      const importLicenses = db.transaction((items) => {
        for (const item of items) insertLicense.run(item);
      });
      importLicenses(
        licenseEntries.map(([key, l]) => ({
          key,
          tier: l.tier,
          durationDays: l.durationDays ?? null,
          createdAt: l.createdAt ?? Date.now(),
          createdBy: l.createdBy ?? null,
          redeemed: l.redeemed ? 1 : 0,
          redeemedBy: l.redeemedBy ?? null,
          guildId: l.guildId ?? null,
          redeemedAt: l.redeemedAt ?? null,
          expiresAt: l.expiresAt ?? null,
        })),
      );
      console.log(`Migrated ${licenseEntries.length} license(s) from JSON into SQLite (${DB_PATH}).`);
    }

    fs.renameSync(legacyFile, `${legacyFile}.migrated`);
  } catch (error) {
    console.error('Failed to migrate legacy global.json — leaving it in place:', error);
  }
}

migrateLegacyGuildConfigs();
migrateLegacyGlobalStore();
migrateEmbeddedXp();

module.exports = { db };
