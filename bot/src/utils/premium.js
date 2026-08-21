const { getConfig, saveConfig } = require('../config/database');
const { getAdminGuildId } = require('./licenses');

// A 3-day grace period after expiry before premium actually cuts off —
// duplicated as a literal (not imported from licenseExpiry.js) because that
// module pulls in the license log and DM-notification machinery, which this
// hot path (called on every single command) has no business depending on.
// The sweep in licenseExpiry.js uses the same value; keep them in sync.
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

function isPremiumActive(guildId) {
  const config = getConfig(guildId);
  if (!config.premium?.active) return false;
  if (!config.premium.expiresAt) return true;

  const now = Date.now();
  if (now <= config.premium.expiresAt) return true;

  // Expired, but still inside the grace period the expiry sweep started.
  const graceEnd = (config.premium.graceStartedAt ?? config.premium.expiresAt) + GRACE_PERIOD_MS;
  if (now < graceEnd) return true;

  config.premium.active = false;
  saveConfig(guildId);
  return false;
}

// The admin/control server always has full access (it's the operator's own
// server), everything else needs an active license.
function isBotUsable(guildId) {
  if (!guildId) return false;
  if (getAdminGuildId() === guildId) return true;
  return isPremiumActive(guildId);
}

async function isBotOwner(client, userId) {
  const app = client.application.owner ? client.application : await client.application.fetch();
  if (app.owner?.members) return app.owner.members.has(userId);
  return app.owner?.id === userId;
}

module.exports = { isPremiumActive, isBotUsable, isBotOwner };
