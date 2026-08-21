const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');
const { logEvent } = require('../utils/eventLog');

function formatMessage(template, member) {
  return template
    .replaceAll('{user.name}', member.user.tag)
    .replaceAll('{user}', member.user.tag)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const config = getConfig(member.guild.id);

    if (config.invitedBy && member.id === config.invitedBy) {
      console.log(`Leaving "${member.guild.name}" (${member.guild.id}) — the member who invited Boat Bot just left.`);
      await member.guild.leave().catch(() => {});
      return;
    }

    if (!isBotUsable(member.guild.id)) return;

    await logEvent(member.guild, 'members', `📤 **${member.user.tag}** left. (${member.guild.memberCount} members)`);

    if (config.leaveChannel) {
      const channel = member.guild.channels.cache.get(config.leaveChannel);
      if (channel) {
        await channel.send({ embeds: [baseEmbed(COLORS.warning).setDescription(formatMessage(config.leaveMessage, member))] }).catch(() => {});
      }
    }

    // Extra goodbye channels added with `,goodbye add`.
    for (const [channelId, template] of Object.entries(config.goodbyeMessages ?? {})) {
      if (channelId === config.leaveChannel) continue;
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel.send({ embeds: [baseEmbed(COLORS.warning).setDescription(formatMessage(template, member))] }).catch(() => {});
    }
  },
};
