const { getConfig, saveConfig } = require('../config/database');

async function liftTempBan(client, guildId, userId) {
  const config = getConfig(guildId);
  if (!config.tempBans[userId]) return;
  delete config.tempBans[userId];
  saveConfig(guildId);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  await guild.members.unban(userId, 'Temp-ban expired').catch(() => {});
}

function scheduleTempBan(client, guildId, userId, delayMs) {
  setTimeout(() => {
    liftTempBan(client, guildId, userId).catch((error) => console.error('Temp-ban lift error:', error));
  }, Math.max(delayMs, 0));
}

module.exports = { scheduleTempBan, liftTempBan };
