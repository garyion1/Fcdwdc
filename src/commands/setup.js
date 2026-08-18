const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuild } = require('../database');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Run the guided initial setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    let modLogChannel = guild.channels.cache.find((c) => c.name === 'mod-logs');
    if (!modLogChannel) {
      modLogChannel = await guild.channels.create({
        name: 'mod-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] }],
      });
    }

    let ticketCategory = guild.channels.cache.find((c) => c.name === 'Tickets' && c.type === ChannelType.GuildCategory);
    if (!ticketCategory) {
      ticketCategory = await guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
    }

    updateGuild(guild.id, (settings) => {
      settings.modLogChannel = modLogChannel.id;
      settings.ticketCategory = ticketCategory.id;
      if (!settings.welcomeChannel && guild.systemChannelId) settings.welcomeChannel = guild.systemChannelId;
      if (!settings.leaveChannel && guild.systemChannelId) settings.leaveChannel = guild.systemChannelId;
    });

    const embed = baseEmbed()
      .setTitle('Setup complete')
      .setDescription('Boat Bot is ready to go.')
      .addFields(
        { name: 'Mod log channel', value: `${modLogChannel}` },
        { name: 'Ticket category', value: `${ticketCategory}` },
        { name: 'Next steps', value: 'Use `/config` to customize welcome/leave messages and `/settings` to configure automod.' },
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
