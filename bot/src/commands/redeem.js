const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { redeemLicense } = require('../utils/licenses');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem a license key to activate premium for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('key').setDescription('Your license key').setRequired(true)),

  async execute(interaction) {
    const key = interaction.options.getString('key', true);
    const result = redeemLicense(key, interaction.guildId, interaction.user.id);

    if (result.error === 'not_found') {
      return interaction.reply({ content: 'That license key was not found. Double-check it and try again.' });
    }
    if (result.error === 'already_redeemed') {
      return interaction.reply({ content: 'That license key has already been redeemed.' });
    }

    const { license } = result;
    const config = getConfig(interaction.guildId);
    config.premium = { active: true, tier: license.tier, licenseKey: license.key, expiresAt: license.expiresAt, expiryWarned: false };
    saveConfig(interaction.guildId);

    const embed = baseEmbed(COLORS.success)
      .setTitle('Premium activated 🎉')
      .addFields(
        { name: 'Tier', value: license.tier, inline: true },
        { name: 'Expires', value: license.expiresAt ? `<t:${Math.floor(license.expiresAt / 1000)}:R>` : 'Never', inline: true },
      );
    return interaction.reply({ embeds: [embed] });
  },
};
