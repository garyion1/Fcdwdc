const { getConfig, saveConfig } = require('../config/database');
const { getAdminGuildId } = require('./licenses');

function isPremiumActive(guildId) {
  const config = getConfig(guildId);
  if (!config.premium?.active) return false;
  if (config.premium.expiresAt && Date.now() > config.premium.expiresAt) {
    config.premium.active = false;
    saveConfig(guildId);
    return false;
  }
  return true;
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
