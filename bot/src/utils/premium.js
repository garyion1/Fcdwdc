const { getConfig, saveConfig } = require('../config/database');

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

async function isBotOwner(client, userId) {
  const app = client.application.owner ? client.application : await client.application.fetch();
  if (app.owner?.members) return app.owner.members.has(userId);
  return app.owner?.id === userId;
}

module.exports = { isPremiumActive, isBotOwner };
