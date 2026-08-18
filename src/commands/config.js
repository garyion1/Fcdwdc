const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuild, updateGuild } = require('../database');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View and edit server configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('view').setDescription('View the current configuration'))
    .addSubcommand((sub) =>
      sub
        .setName('welcome-channel')
        .setDescription('Set the welcome message channel')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('welcome-message')
        .setDescription('Set the welcome message text')
        .addStringOption((opt) => opt.setName('message').setDescription('Use {user}, {server}, {membercount}').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('leave-channel')
        .setDescription('Set the leave message channel')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Channel for leave messages').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('leave-message')
        .setDescription('Set the leave message text')
        .addStringOption((opt) => opt.setName('message').setDescription('Use {user}, {server}, {membercount}').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('modlog-channel')
        .setDescription('Set the moderation log channel')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Channel for mod logs').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'view') {
      const settings = getGuild(guildId);
      const embed = baseEmbed()
        .setTitle('Server configuration')
        .addFields(
          { name: 'Welcome channel', value: settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : 'Not set', inline: true },
          { name: 'Leave channel', value: settings.leaveChannel ? `<#${settings.leaveChannel}>` : 'Not set', inline: true },
          { name: 'Mod log channel', value: settings.modLogChannel ? `<#${settings.modLogChannel}>` : 'Not set', inline: true },
          { name: 'Welcome message', value: settings.welcomeMessage },
          { name: 'Leave message', value: settings.leaveMessage },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'welcome-channel') {
      const channel = interaction.options.getChannel('channel');
      updateGuild(guildId, (s) => (s.welcomeChannel = channel.id));
      return interaction.reply({ content: `Welcome channel set to ${channel}.`, ephemeral: true });
    }

    if (sub === 'welcome-message') {
      const message = interaction.options.getString('message');
      updateGuild(guildId, (s) => (s.welcomeMessage = message));
      return interaction.reply({ content: 'Welcome message updated.', ephemeral: true });
    }

    if (sub === 'leave-channel') {
      const channel = interaction.options.getChannel('channel');
      updateGuild(guildId, (s) => (s.leaveChannel = channel.id));
      return interaction.reply({ content: `Leave channel set to ${channel}.`, ephemeral: true });
    }

    if (sub === 'leave-message') {
      const message = interaction.options.getString('message');
      updateGuild(guildId, (s) => (s.leaveMessage = message));
      return interaction.reply({ content: 'Leave message updated.', ephemeral: true });
    }

    if (sub === 'modlog-channel') {
      const channel = interaction.options.getChannel('channel');
      updateGuild(guildId, (s) => (s.modLogChannel = channel.id));
      return interaction.reply({ content: `Mod log channel set to ${channel}.`, ephemeral: true });
    }
  },
};
