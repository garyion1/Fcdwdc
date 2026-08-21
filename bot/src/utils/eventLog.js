const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('./embeds');

// Per-event logging configured with `,log add <event> <#channel>`. Falls back to
// nothing when that event has no channel — the older single logChannel setting
// is handled separately by the message events that already used it.
async function logEvent(guild, event, description, color = COLORS.primary) {
  if (!guild) return;
  const config = getConfig(guild.id);
  const channelId = config.logEvents?.[event];
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  if (config.logIgnored?.includes(channel.id)) return;

  await channel.send({ embeds: [baseEmbed(color).setDescription(description)] }).catch(() => {});
}

module.exports = { logEvent };
