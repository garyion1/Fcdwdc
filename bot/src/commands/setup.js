const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Run the guided initial setup for Boat Bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) => o.setName('welcome_channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('leave_channel').setDescription('Channel for leave messages').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('log_channel').setDescription('Channel for server logs').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('mod_log_channel').setDescription('Channel for moderation logs').addChannelTypes(ChannelType.GuildText))
    .addChannelOption((o) => o.setName('ticket_category').setDescription('Category tickets will be created under').addChannelTypes(ChannelType.GuildCategory))
    .addRoleOption((o) => o.setName('autorole').setDescription('Role automatically given to new members')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const config = getConfig(guildId);

    const welcome = interaction.options.getChannel('welcome_channel');
    const leave = interaction.options.getChannel('leave_channel');
    const log = interaction.options.getChannel('log_channel');
    const modLog = interaction.options.getChannel('mod_log_channel');
    const ticketCategory = interaction.options.getChannel('ticket_category');
    const autorole = interaction.options.getRole('autorole');

    if (welcome) config.welcomeChannel = welcome.id;
    if (leave) config.leaveChannel = leave.id;
    if (log) config.logChannel = log.id;
    if (modLog) config.modLogChannel = modLog.id;
    if (ticketCategory) config.ticketCategory = ticketCategory.id;
    if (autorole) config.autorole = autorole.id;

    saveConfig(guildId);

    const embed = baseEmbed(COLORS.success)
      .setTitle('Setup complete')
      .setDescription('Boat Bot has been configured for this server. Run `/setup` again anytime to update these settings, or fine-tune individual options with `/settings`.')
      .addFields(
        { name: 'Welcome channel', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Not set', inline: true },
        { name: 'Leave channel', value: config.leaveChannel ? `<#${config.leaveChannel}>` : 'Not set', inline: true },
        { name: 'Log channel', value: config.logChannel ? `<#${config.logChannel}>` : 'Not set', inline: true },
        { name: 'Mod log channel', value: config.modLogChannel ? `<#${config.modLogChannel}>` : 'Not set', inline: true },
        { name: 'Ticket category', value: config.ticketCategory ? `<#${config.ticketCategory}>` : 'Not set', inline: true },
        { name: 'Autorole', value: config.autorole ? `<@&${config.autorole}>` : 'Not set', inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
