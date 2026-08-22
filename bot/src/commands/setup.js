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
    .addRoleOption((o) => o.setName('autorole').setDescription('Role automatically given to new members')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const config = getConfig(guildId);

    const welcome = interaction.options.getChannel('welcome_channel');
    const leave = interaction.options.getChannel('leave_channel');
    const log = interaction.options.getChannel('log_channel');
    const modLog = interaction.options.getChannel('mod_log_channel');
    const autorole = interaction.options.getRole('autorole');

    if (welcome) config.welcomeChannel = welcome.id;
    if (leave) config.leaveChannel = leave.id;
    if (log) config.logChannel = log.id;
    if (modLog) config.modLogChannel = modLog.id;
    if (autorole) config.autoroles = [{ roleId: autorole.id, target: 'all' }];

    saveConfig(guildId);

    const embed = baseEmbed(COLORS.success)
      .setTitle('Setup complete')
      .setDescription(
        'Boat Bot has been configured for this server. Run `/setup` again anytime to update these settings, fine-tune ' +
          'individual options with `/settings`, or set up the ticket system with `/ticketsetup`.',
      )
      .addFields(
        { name: 'Welcome channel', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Not set', inline: true },
        { name: 'Leave channel', value: config.leaveChannel ? `<#${config.leaveChannel}>` : 'Not set', inline: true },
        { name: 'Log channel', value: config.logChannel ? `<#${config.logChannel}>` : 'Not set', inline: true },
        { name: 'Mod log channel', value: config.modLogChannel ? `<#${config.modLogChannel}>` : 'Not set', inline: true },
        { name: 'Autorole', value: config.autoroles.length > 0 ? `${config.autoroles.length} role(s) — see \`,autorole list\`` : 'Not set', inline: true },
        { name: 'Prefixes', value: config.prefixes.map((p) => `\`${p}\``).join(', '), inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
