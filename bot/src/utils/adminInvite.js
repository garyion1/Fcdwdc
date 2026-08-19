const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getAdminGuildId } = require('./licenses');

// A permanent, reusable invite to the admin/support server. unique:false
// makes Discord hand back an existing matching invite instead of minting a
// fresh one every time this is called.
async function getAdminServerInvite(client) {
  const adminGuildId = getAdminGuildId();
  if (!adminGuildId) return null;

  const guild = client.guilds.cache.get(adminGuildId);
  if (!guild) return null;

  const channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite),
  );
  if (!channel) return null;

  const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false }).catch(() => null);
  return invite ? `https://discord.gg/${invite.code}` : null;
}

module.exports = { getAdminServerInvite };
