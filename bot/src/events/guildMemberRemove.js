const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

function formatMessage(template, member) {
  return template
    .replaceAll('{user}', member.user.tag)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const config = getConfig(member.guild.id);
    if (!config.leaveChannel) return;
    const channel = member.guild.channels.cache.get(config.leaveChannel);
    if (!channel) return;
    const text = formatMessage(config.leaveMessage, member);
    await channel.send({ embeds: [baseEmbed(COLORS.warning).setDescription(text)] }).catch(() => {});
  },
};
