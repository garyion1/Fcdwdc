const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View statistics for this server.'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.members.fetch().catch(() => {});

    const totalMembers = guild.memberCount;
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = totalMembers - humans;
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const roles = guild.roles.cache.size;
    const boosts = guild.premiumSubscriptionCount ?? 0;

    const embed = baseEmbed()
      .setTitle(`${guild.name} — Server Statistics`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Members', value: `${totalMembers} (${humans} humans, ${bots} bots)`, inline: true },
        { name: 'Channels', value: `${textChannels} text, ${voiceChannels} voice`, inline: true },
        { name: 'Roles', value: `${roles}`, inline: true },
        { name: 'Boosts', value: `${boosts} (Level ${guild.premiumTier})`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
