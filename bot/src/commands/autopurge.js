const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { schedulePurge, stopPurge } = require('../utils/autopurge');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autopurge')
    .setDescription('Automatically purge a channel on a repeating interval.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable autopurge for a channel.')
        .addIntegerOption((o) => o.setName('minutes').setDescription('Purge interval in minutes (5-10080)').setRequired(true).setMinValue(5).setMaxValue(10080))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to autopurge (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable autopurge for a channel.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to stop autopurging (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('List channels with autopurge enabled.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'enable') {
      const minutes = interaction.options.getInteger('minutes', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      config.autopurge[channel.id] = { intervalMinutes: minutes, enabledBy: interaction.user.id, enabledAt: Date.now() };
      saveConfig(interaction.guildId);
      schedulePurge(interaction.client, interaction.guildId, channel.id, minutes);
      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.warning).setDescription(
            `🧹 ${channel} will be automatically purged every ${minutes} minute(s).\n(Only messages under 14 days old can be removed — a Discord API limit.)`,
          ),
        ],
      });
    }

    if (sub === 'disable') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (!config.autopurge[channel.id]) {
        return interaction.reply({ content: `Autopurge is not enabled in ${channel}.` });
      }
      stopPurge(channel.id);
      delete config.autopurge[channel.id];
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`🧹 Autopurge disabled for ${channel}.`)] });
    }

    if (sub === 'status') {
      const entries = Object.entries(config.autopurge);
      if (entries.length === 0) return interaction.reply({ content: 'Autopurge is not enabled in any channel.' });
      const list = entries.map(([channelId, entry]) => `<#${channelId}> — every ${entry.intervalMinutes}m`).join('\n');
      return interaction.reply({ embeds: [baseEmbed().setTitle('Autopurge Status').setDescription(list)] });
    }
  },
};
