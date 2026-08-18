const { SlashCommandBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { isPremiumActive } = require('../utils/premium');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('premium').setDescription("View this server's premium status."),

  async execute(interaction) {
    const active = isPremiumActive(interaction.guildId);
    const config = getConfig(interaction.guildId);

    const embed = baseEmbed(active ? COLORS.success : COLORS.warning)
      .setTitle(active ? '⭐ Premium is active' : 'No active premium')
      .addFields(
        { name: 'Tier', value: config.premium.tier ?? 'None', inline: true },
        { name: 'Expires', value: config.premium.expiresAt ? `<t:${Math.floor(config.premium.expiresAt / 1000)}:R>` : active ? 'Never' : 'N/A', inline: true },
      );
    if (!active) embed.setDescription('Activate premium with `/redeem <key>` using a license key from the bot operator.');

    await interaction.reply({ embeds: [embed] });
  },
};
