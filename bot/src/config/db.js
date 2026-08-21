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
`);

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

module.exports = { db };
