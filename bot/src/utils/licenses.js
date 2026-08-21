const { db } = require('../config/db');

const getMetaStmt = db.prepare('SELECT value FROM meta WHERE key = ?');
const setMetaStmt = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getAdminGuildId() {
  return getMetaStmt.get('adminGuildId')?.value ?? null;
}

function setAdminGuildId(guildId) {
  setMetaStmt.run('adminGuildId', guildId);
}

function generateLicenseKey() {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BOAT-${segment()}-${segment()}-${segment()}`;
}

const insertLicenseStmt = db.prepare(`
  INSERT INTO licenses (key, tier, duration_days, created_at, created_by, redeemed, redeemed_by, guild_id, redeemed_at, expires_at, price)
  VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?)
`);
const getLicenseRowStmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
const redeemLicenseStmt = db.prepare(
  'UPDATE licenses SET redeemed = 1, redeemed_by = ?, guild_id = ?, redeemed_at = ?, expires_at = ? WHERE key = ?',
);
const revokeLicenseStmt = db.prepare(
  'UPDATE licenses SET redeemed = 0, redeemed_by = NULL, guild_id = NULL, redeemed_at = NULL, expires_at = NULL WHERE key = ?',
);
const extendLicenseStmt = db.prepare('UPDATE licenses SET expires_at = ? WHERE key = ?');
const listLicensesStmt = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC');

function rowToLicense(row) {
  if (!row) return null;
  return {
    tier: row.tier,
    durationDays: row.duration_days,
    createdAt: row.created_at,
    createdBy: row.created_by,
    redeemed: !!row.redeemed,
    redeemedBy: row.redeemed_by,
    guildId: row.guild_id,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at,
    price: row.price ?? null,
  };
}

function createLicense(tier, durationDays, createdBy, price) {
  let key = generateLicenseKey();
  while (getLicenseRowStmt.get(key)) key = generateLicenseKey();
  insertLicenseStmt.run(key, tier, durationDays ?? null, Date.now(), createdBy, price ?? null);
  return key;
}

// Adds days to a redeemed, non-lifetime license — extends from its current
// expiry if it hasn't lapsed yet, or from now if it already has, so a late
// renewal doesn't lose the days between expiry and payment.
function extendLicense(key, days) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };
  if (!license.redeemed) return { error: 'not_redeemed' };
  if (!license.durationDays) return { error: 'lifetime' };

  const base = license.expiresAt && license.expiresAt > Date.now() ? license.expiresAt : Date.now();
  const expiresAt = base + days * 86400000;
  extendLicenseStmt.run(expiresAt, normalizedKey);
  return { expiresAt, guildId: license.guildId };
}

function getLicense(key) {
  return rowToLicense(getLicenseRowStmt.get(key.trim().toUpperCase()));
}

function redeemLicense(key, guildId, userId) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };
  if (license.redeemed) return { error: 'already_redeemed' };

  const expiresAt = license.durationDays ? Date.now() + license.durationDays * 86400000 : null;
  const redeemedAt = Date.now();
  redeemLicenseStmt.run(userId, guildId, redeemedAt, expiresAt, normalizedKey);
  return { license: { ...license, redeemed: true, redeemedBy: userId, guildId, redeemedAt, expiresAt, key: normalizedKey } };
}

function revokeLicense(key) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };
  const guildId = license.guildId;
  revokeLicenseStmt.run(normalizedKey);
  return { guildId };
}

function listLicenses() {
  return listLicensesStmt.all().map((row) => ({ key: row.key, ...rowToLicense(row) }));
}

const listUserLicensesStmt = db.prepare('SELECT * FROM licenses WHERE redeemed = 1 AND redeemed_by = ?');

// Whether this person personally holds a still-valid license (lifetime, or
// monthly and not yet expired) — regardless of which server they redeemed it
// in. Used to gate who's allowed to have the bot in a server at all.
function hasActiveLicenseForUser(userId) {
  const now = Date.now();
  return listUserLicensesStmt.all(userId).some((row) => !row.expires_at || row.expires_at > now);
}

// Every license a person personally holds, across every server, for `/mylicense`.
function listLicensesForUser(userId) {
  return listUserLicensesStmt.all(userId).map((row) => ({ key: row.key, ...rowToLicense(row) }));
}

module.exports = {
  getAdminGuildId,
  setAdminGuildId,
  createLicense,
  getLicense,
  redeemLicense,
  revokeLicense,
  extendLicense,
  listLicenses,
  listLicensesForUser,
  hasActiveLicenseForUser,
};
