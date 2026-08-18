const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getAdminGuildId, setAdminGuildId } = require('../utils/licenses');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    if (getAdminGuildId()) return;

    setAdminGuildId(guild.id);
    console.log(`No admin server was set — designated "${guild.name}" (${guild.id}) as the license admin server.`);

    const channel =
      (guild.systemChannel?.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages) ? guild.systemChannel : null) ??
      guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages),
      );
    if (!channel) return;

    await channel
      .send({
        embeds: [
          baseEmbed(COLORS.primary)
            .setTitle('👑 This is now the Boat Bot admin server')
            .setDescription(
              'Because this was the first server Boat Bot joined, it has been set as the **admin/control server** for licensing.\n\n' +
                'From here, server admins can generate and manage license keys with `/license generate`, `/license list`, `/license info`, ' +
                'and `/license revoke`.\n\n' +
                'Any server (including this one) activates premium with `/redeem <key>`, and can check its status with `/premium`.\n\n' +
                'If this server was added by mistake, the bot owner can move admin control with `/adminserver set` in the correct server.',
            ),
        ],
      })
      .catch(() => {});
  },
};
