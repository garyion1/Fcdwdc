const { getAdminGuildId, getLicenseLogChannel } = require('./licenses');
const { baseEmbed, COLORS } = require('./embeds');

// Posts every redeem/revoke/extend/expire/regenerate to a channel in the
// admin server, so the operator doesn't have to run /license list to see
// what's happening. Silently does nothing until a channel is set with
// /license logchannel.
async function logLicenseEvent(client, message, color = COLORS.primary) {
  const adminGuildId = getAdminGuildId();
  const channelId = getLicenseLogChannel();
  if (!adminGuildId || !channelId) return;

  const guild = client.guilds.cache.get(adminGuildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) return;

  await channel.send({ embeds: [baseEmbed(color).setDescription(message)] }).catch(() => {});
}

module.exports = { logLicenseEvent };
