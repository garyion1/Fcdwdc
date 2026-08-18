const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database');

function format(template, member) {
  return template
    .replaceAll('{user}', member.user.tag)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const settings = getGuild(member.guild.id);
    if (!settings.leaveChannel) return;
    const channel = member.guild.channels.cache.get(settings.leaveChannel);
    if (!channel) return;
    const embed = new EmbedBuilder().setColor(0xed4245).setDescription(format(settings.leaveMessage, member)).setThumbnail(member.user.displayAvatarURL());
    channel.send({ embeds: [embed] }).catch(() => {});
  },
};
