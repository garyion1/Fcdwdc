const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database');

function format(template, member) {
  return template
    .replaceAll('{user}', `${member}`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const settings = getGuild(member.guild.id);
    if (!settings.welcomeChannel) return;
    const channel = member.guild.channels.cache.get(settings.welcomeChannel);
    if (!channel) return;
    const embed = new EmbedBuilder().setColor(0x57f287).setDescription(format(settings.welcomeMessage, member)).setThumbnail(member.user.displayAvatarURL());
    channel.send({ embeds: [embed] }).catch(() => {});
  },
};
