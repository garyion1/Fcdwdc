const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'global.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function defaultGlobal() {
  return { adminGuildId: null, licenses: {} };
}

let cache = null;

function loadGlobal() {
  if (cache) return cache;
  if (fs.existsSync(FILE_PATH)) {
    try {
      cache = { ...defaultGlobal(), ...JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) };
    } catch (error) {
      console.error('Failed to read global store, using defaults:', error);
      cache = defaultGlobal();
    }
  } else {
    cache = defaultGlobal();
  }
  return cache;
}

function saveGlobal() {
  if (!cache) return;
  fs.writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2));
}

function getAdminGuildId() {
  return loadGlobal().adminGuildId;
}

function setAdminGuildId(guildId) {
  const global = loadGlobal();
  global.adminGuildId = guildId;
  saveGlobal();
}

function generateLicenseKey() {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BOAT-${segment()}-${segment()}-${segment()}`;
}

function createLicense(tier, durationDays, createdBy) {
  const global = loadGlobal();
  let key = generateLicenseKey();
  while (global.licenses[key]) key = generateLicenseKey();

  global.licenses[key] = {
    tier,
    durationDays: durationDays ?? null,
    createdAt: Date.now(),
    createdBy,
    redeemed: false,
    redeemedBy: null,
    guildId: null,
    redeemedAt: null,
    expiresAt: null,
  };
  saveGlobal();
  return key;
}

function getLicense(key) {
  return loadGlobal().licenses[key.trim().toUpperCase()] ?? null;
}

function redeemLicense(key, guildId, userId) {
  const global = loadGlobal();
  const normalizedKey = key.trim().toUpperCase();
  const license = global.licenses[normalizedKey];
  if (!license) return { error: 'not_found' };
  if (license.redeemed) return { error: 'already_redeemed' };

  const expiresAt = license.durationDays ? Date.now() + license.durationDays * 86400000 : null;
  license.redeemed = true;
  license.redeemedBy = userId;
  license.guildId = guildId;
  license.redeemedAt = Date.now();
  license.expiresAt = expiresAt;
  saveGlobal();
  return { license: { ...license, key: normalizedKey } };
}

function revokeLicense(key) {
  const global = loadGlobal();
  const normalizedKey = key.trim().toUpperCase();
  const license = global.licenses[normalizedKey];
  if (!license) return { error: 'not_found' };

  const guildId = license.guildId;
  license.redeemed = false;
  license.redeemedBy = null;
  license.guildId = null;
  license.expiresAt = null;
  license.redeemedAt = null;
  saveGlobal();
  return { guildId };
}

function listLicenses() {
  return Object.entries(loadGlobal().licenses).map(([key, data]) => ({ key, ...data }));
}

module.exports = {
  getAdminGuildId,
  setAdminGuildId,
  createLicense,
  getLicense,
  redeemLicense,
  revokeLicense,
  listLicenses,
};
