const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isRaidActive, endRaidMode } = require('../utils/antiraid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('Configure anti-raid detection and response.')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn burst-join detection on or off'))
        .addIntegerOption((o) =>
          o.setName('join_threshold').setDescription('Joins within the window that trigger raid mode (2-50)').setMinValue(2).setMaxValue(50),
        )
        .addIntegerOption((o) => o.setName('window_seconds').setDescription('Time window in seconds (5-300)').setMinValue(5).setMaxValue(300))
        .addIntegerOption((o) =>
          o
            .setName('min_account_age_minutes')
            .setDescription('Auto-remove accounts younger than this, always active (0 disables)')
            .setMinValue(0)
            .setMaxValue(10080),
        )
        .addStringOption((o) =>
          o
            .setName('action')
            .setDescription('What to do to underage accounts')
            .addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }),
        )
        .addBooleanOption((o) => o.setName('lockdown_on_raid').setDescription('Lock all text channels when raid mode triggers'))
        .addChannelOption((o) => o.setName('alert_channel').setDescription('Channel for raid alerts').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) => sub.setName('end').setDescription('Manually end raid mode and unlock any auto-locked channels.'))
    .addSubcommand((sub) => sub.setName('status').setDescription('View anti-raid configuration and current state.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'settings') {
      const enabled = interaction.options.getBoolean('enabled');
      const joinThreshold = interaction.options.getInteger('join_threshold');
      const windowSeconds = interaction.options.getInteger('window_seconds');
      const minAge = interaction.options.getInteger('min_account_age_minutes');
      const action = interaction.options.getString('action');
      const lockdown = interaction.options.getBoolean('lockdown_on_raid');
      const alertChannel = interaction.options.getChannel('alert_channel');

      if (enabled !== null) config.antiraid.enabled = enabled;
      if (joinThreshold !== null) config.antiraid.joinThreshold = joinThreshold;
      if (windowSeconds !== null) config.antiraid.windowSeconds = windowSeconds;
      if (minAge !== null) config.antiraid.minAccountAgeMinutes = minAge;
      if (action) config.antiraid.action = action;
      if (lockdown !== null) config.antiraid.lockdownOnRaid = lockdown;
      if (alertChannel) config.antiraid.alertChannel = alertChannel.id;
      saveConfig(interaction.guildId);

      const embed = baseEmbed(COLORS.success)
        .setTitle('Anti-raid settings updated')
        .addFields(
          { name: 'Enabled', value: config.antiraid.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Join threshold', value: `${config.antiraid.joinThreshold} / ${config.antiraid.windowSeconds}s`, inline: true },
          { name: 'Min account age', value: config.antiraid.minAccountAgeMinutes > 0 ? `${config.antiraid.minAccountAgeMinutes}m` : 'Disabled', inline: true },
          { name: 'Action on underage', value: config.antiraid.action, inline: true },
          { name: 'Lockdown on raid', value: config.antiraid.lockdownOnRaid ? 'Yes' : 'No', inline: true },
          { name: 'Alert channel', value: config.antiraid.alertChannel ? `<#${config.antiraid.alertChannel}>` : 'Not set', inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'end') {
      const result = await endRaidMode(interaction.guild, interaction.user);
      if (result.notActive) return interaction.reply({ content: 'Raid mode is not currently active.', flags: MessageFlags.Ephemeral });
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription('✅ Raid mode ended and locked channels restored.')] });
    }

    if (sub === 'status') {
      const active = isRaidActive(interaction.guildId);
      const embed = baseEmbed()
        .setTitle('Anti-raid Status')
        .addFields(
          { name: 'Enabled', value: config.antiraid.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Raid mode active', value: active ? 'Yes 🚨' : 'No', inline: true },
          { name: 'Join threshold', value: `${config.antiraid.joinThreshold} joins / ${config.antiraid.windowSeconds}s`, inline: true },
          { name: 'Min account age', value: config.antiraid.minAccountAgeMinutes > 0 ? `${config.antiraid.minAccountAgeMinutes}m` : 'Disabled', inline: true },
          { name: 'Action on underage', value: config.antiraid.action, inline: true },
          { name: 'Lockdown on raid', value: config.antiraid.lockdownOnRaid ? 'Yes' : 'No', inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
