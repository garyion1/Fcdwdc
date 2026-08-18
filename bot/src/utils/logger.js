const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('./embeds');

async function logAction(guild, message) {
  const config = getConfig(guild.id);
  if (!config.modLogChannel) return;
  const channel = guild.channels.cache.get(config.modLogChannel);
  if (!channel) return;
  await channel.send({ embeds: [baseEmbed(COLORS.danger).setDescription(message)] }).catch(() => {});
}

module.exports = { logAction };
