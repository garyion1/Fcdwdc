const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

function formatMessage(template, member) {
  return template
    .replaceAll('{user}', `${member}`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = getConfig(member.guild.id);

    if (config.welcomeChannel) {
      const channel = member.guild.channels.cache.get(config.welcomeChannel);
      if (channel) {
        const text = formatMessage(config.welcomeMessage, member);
        await channel
          .send({ embeds: [baseEmbed(COLORS.success).setDescription(text).setThumbnail(member.user.displayAvatarURL())] })
          .catch(() => {});
      }
    }

    if (config.autorole) {
      const role = member.guild.roles.cache.get(config.autorole);
      if (role) await member.roles.add(role).catch(() => {});
    }
  },
};
