const { db } = require('../config/db');

const getMetaStmt = db.prepare('SELECT value FROM meta WHERE key = ?');
const setMetaStmt = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getAdminGuildId() {
  return getMetaStmt.get('adminGuildId')?.value ?? null;
}

function setAdminGuildId(guildId) {
  setMetaStmt.run('adminGuildId', guildId);
}

function getLicenseLogChannel() {
  return getMetaStmt.get('licenseLogChannelId')?.value ?? null;
}

function setLicenseLogChannel(channelId) {
  setMetaStmt.run('licenseLogChannelId', channelId);
}

function generateLicenseKey() {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BOAT-${segment()}-${segment()}-${segment()}`;
}

const insertLicenseStmt = db.prepare(`
  INSERT INTO licenses (key, tier, duration_days, created_at, created_by, redeemed, redeemed_by, guild_id, redeemed_at, expires_at, price, seats)
  VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?)
`);
const getLicenseRowStmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
const deleteLicenseStmt = db.prepare('DELETE FROM licenses WHERE key = ?');
// These mirror the most recently redeemed seat onto the licenses row itself,
// so anything that only needs "the" redemption (give.js's DM, /license info's
// headline fields) doesn't need to know about multi-seat licenses at all.
// license_seats (below) is the actual source of truth for "where is this
// active right now".
const redeemLicenseStmt = db.prepare(
  'UPDATE licenses SET redeemed = 1, redeemed_by = ?, guild_id = ?, redeemed_at = ?, expires_at = ? WHERE key = ?',
);
const revokeLicenseStmt = db.prepare(
  'UPDATE licenses SET redeemed = 0, redeemed_by = NULL, guild_id = NULL, redeemed_at = NULL, expires_at = NULL WHERE key = ?',
);
const extendLicenseStmt = db.prepare('UPDATE licenses SET expires_at = ? WHERE key = ?');
const listLicensesStmt = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC');

const countSeatsStmt = db.prepare('SELECT COUNT(*) AS n FROM license_seats WHERE license_key = ?');
const getSeatStmt = db.prepare('SELECT * FROM license_seats WHERE license_key = ? AND guild_id = ?');
const listSeatsStmt = db.prepare('SELECT * FROM license_seats WHERE license_key = ? ORDER BY redeemed_at ASC');
const insertSeatStmt = db.prepare('INSERT INTO license_seats (license_key, guild_id, redeemed_by, redeemed_at) VALUES (?, ?, ?, ?)');
const deleteAllSeatsStmt = db.prepare('DELETE FROM license_seats WHERE license_key = ?');
const reassignSeatsStmt = db.prepare('UPDATE license_seats SET license_key = ? WHERE license_key = ?');
// Explicit column list, not `licenses.*` — license_seats and licenses both
// have a guild_id column, and letting them collide in a plain-object result
// row would silently pick whichever one the driver applies last.
const listSeatsForUserStmt = db.prepare(`
  SELECT
    license_seats.guild_id AS guild_id,
    license_seats.redeemed_at AS redeemed_at,
    license_seats.redeemed_by AS redeemed_by,
    licenses.key AS key,
    licenses.tier AS tier,
    licenses.duration_days AS duration_days,
    licenses.price AS price,
    licenses.expires_at AS expires_at,
    licenses.seats AS seats
  FROM license_seats
  JOIN licenses ON licenses.key = license_seats.license_key
  WHERE license_seats.redeemed_by = ?
`);

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
    seats: row.seats ?? 1,
  };
}

function createLicense(tier, durationDays, createdBy, price, seats) {
  let key = generateLicenseKey();
  while (getLicenseRowStmt.get(key)) key = generateLicenseKey();
  insertLicenseStmt.run(key, tier, durationDays ?? null, Date.now(), createdBy, price ?? null, seats && seats > 0 ? seats : 1);
  return key;
}

function getLicense(key) {
  return rowToLicense(getLicenseRowStmt.get(key.trim().toUpperCase()));
}

// Full picture of one key: the license itself, plus how many of its seats
// are used and which guilds hold them — what `/license info` shows.
function getLicenseDetail(key) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return null;
  const seatRows = listSeatsStmt.all(normalizedKey);
  return { ...license, key: normalizedKey, seatsUsed: seatRows.length, activeGuildIds: seatRows.map((row) => row.guild_id) };
}

// Adds one more server to a license. A single-seat key (the default) behaves
// exactly as before; a multi-seat key shares ONE expiry across every server
// it's active in — set from the first redemption, not restarted per seat.
function redeemLicense(key, guildId, userId) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };
  if (getSeatStmt.get(normalizedKey, guildId)) return { error: 'already_redeemed_here' };

  const used = countSeatsStmt.get(normalizedKey).n;
  if (used >= license.seats) return { error: 'seat_limit_reached', seats: license.seats, used };

  const isFirstSeat = used === 0;
  const expiresAt = isFirstSeat ? (license.durationDays ? Date.now() + license.durationDays * 86400000 : null) : license.expiresAt;
  const redeemedAt = Date.now();

  insertSeatStmt.run(normalizedKey, guildId, userId, redeemedAt);
  redeemLicenseStmt.run(userId, guildId, redeemedAt, expiresAt, normalizedKey);

  return { license: { ...license, redeemed: true, redeemedBy: userId, guildId, redeemedAt, expiresAt, key: normalizedKey, seatsUsed: used + 1 } };
}

// Adds days to a redeemed, non-lifetime license — extends from its current
// expiry if it hasn't lapsed yet, or from now if it already has, so a late
// renewal doesn't lose the days between expiry and payment. Applies to every
// server the key is currently active in.
function extendLicense(key, days) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };
  if (!license.redeemed) return { error: 'not_redeemed' };
  if (!license.durationDays) return { error: 'lifetime' };

  const base = license.expiresAt && license.expiresAt > Date.now() ? license.expiresAt : Date.now();
  const expiresAt = base + days * 86400000;
  extendLicenseStmt.run(expiresAt, normalizedKey);

  const guildIds = listSeatsStmt.all(normalizedKey).map((row) => row.guild_id);
  return { expiresAt, guildIds };
}

// Revokes every seat a key holds, everywhere — killing a key means killing
// it for every server it's active in, not just one.
function revokeLicense(key) {
  const normalizedKey = key.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedKey));
  if (!license) return { error: 'not_found' };

  const guildIds = listSeatsStmt.all(normalizedKey).map((row) => row.guild_id);
  deleteAllSeatsStmt.run(normalizedKey);
  revokeLicenseStmt.run(normalizedKey);
  return { guildIds };
}

// Issues a fresh key carrying over everything from an old one (tier, price,
// seat limit, expiry, and every active seat) and deletes the old key so it
// can never be redeemed again — for a leaked key, without a customer losing
// their remaining time.
function regenerateLicense(oldKey) {
  const normalizedOld = oldKey.trim().toUpperCase();
  const license = rowToLicense(getLicenseRowStmt.get(normalizedOld));
  if (!license) return { error: 'not_found' };

  let newKey = generateLicenseKey();
  while (getLicenseRowStmt.get(newKey)) newKey = generateLicenseKey();

  insertLicenseStmt.run(newKey, license.tier, license.durationDays, Date.now(), license.createdBy, license.price, license.seats);
  if (license.redeemed) {
    redeemLicenseStmt.run(license.redeemedBy, license.guildId, license.redeemedAt, license.expiresAt, newKey);
  }

  reassignSeatsStmt.run(newKey, normalizedOld);
  deleteLicenseStmt.run(normalizedOld);

  const guildIds = listSeatsStmt.all(newKey).map((row) => row.guild_id);
  return { newKey, guildIds };
}

function listLicenses() {
  return listLicensesStmt.all().map((row) => ({ key: row.key, ...rowToLicense(row) }));
}

// Whether this person personally holds a still-valid seat (lifetime, or
// monthly and not yet expired) on ANY license, in ANY server — used to gate
// who's allowed to have the bot in a server at all (the inviter check).
function hasActiveLicenseForUser(userId) {
  const now = Date.now();
  return listSeatsForUserStmt.all(userId).some((row) => !row.expires_at || row.expires_at > now);
}

// Every seat a person personally holds, across every license and every
// server, for `/mylicense`.
function listLicensesForUser(userId) {
  return listSeatsForUserStmt.all(userId);
}

module.exports = {
  getAdminGuildId,
  setAdminGuildId,
  getLicenseLogChannel,
  setLicenseLogChannel,
  createLicense,
  getLicense,
  getLicenseDetail,
  redeemLicense,
  revokeLicense,
  extendLicense,
  regenerateLicense,
  listLicenses,
  listLicensesForUser,
  hasActiveLicenseForUser,
};
