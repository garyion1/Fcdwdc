const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig, defaultConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View or reset Boat Bot configuration for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('view').setDescription('View the current configuration.'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('Reset configuration back to defaults.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'reset') {
      const config = getConfig(guildId);
      Object.assign(config, defaultConfig());
      saveConfig(guildId);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setTitle('Configuration reset').setDescription('All settings have been reset to their defaults.')]
      });
    }

    const config = getConfig(guildId);
    const embed = baseEmbed()
      .setTitle('Current configuration')
      .addFields(
        { name: 'Welcome channel', value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Not set', inline: true },
        { name: 'Leave channel', value: config.leaveChannel ? `<#${config.leaveChannel}>` : 'Not set', inline: true },
        { name: 'Log channel', value: config.logChannel ? `<#${config.logChannel}>` : 'Not set', inline: true },
        { name: 'Mod log channel', value: config.modLogChannel ? `<#${config.modLogChannel}>` : 'Not set', inline: true },
        { name: 'Autorole', value: config.autoroles.length > 0 ? `${config.autoroles.length} role(s)` : 'Not set', inline: true },
        { name: 'Prefixes', value: config.prefixes.map((p) => `\`${p}\``).join(', '), inline: true },
        { name: 'Automod', value: config.automod.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Custom commands', value: `${Object.keys(config.customCommands).length}`, inline: true },
        { name: 'Reaction roles', value: `${Object.keys(config.reactionRoles).length}`, inline: true },
        { name: 'Ticket types', value: `${Object.keys(config.tickets.types).length}`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
