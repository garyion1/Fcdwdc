const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
  data: new SlashCommandBuilder().setName('stats').setDescription('View server statistics'),
  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch();
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;

    const embed = baseEmbed()
      .setTitle(`${guild.name} -- Server statistics`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Members', value: `${guild.memberCount} (${humans} humans, ${bots} bots)`, inline: true },
        { name: 'Text channels', value: `${guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread()).size}`, inline: true },
        { name: 'Voice channels', value: `${guild.channels.cache.filter((c) => c.isVoiceBased()).size}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Bot uptime', value: formatUptime(interaction.client.uptime) },
      );
    await interaction.reply({ embeds: [embed] });
  },
};
