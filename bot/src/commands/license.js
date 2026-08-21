const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAdminGuildId, createLicense, getLicense, revokeLicense, extendLicense, listLicenses } = require('../utils/licenses');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

function requireAdminGuild(interaction) {
  const adminGuildId = getAdminGuildId();
  if (interaction.guildId !== adminGuildId) {
    return 'License commands can only be used in the admin/control server. See `/adminserver status` to check which server that is.';
  }
  return null;
}

module.exports = {
  requireAdminGuild,
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Generate and manage premium license keys (admin server only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('generate')
        .setDescription('Generate a new license key.')
        .addStringOption((o) =>
          o
            .setName('tier')
            .setDescription('License tier')
            .setRequired(true)
            .addChoices({ name: 'Monthly', value: 'monthly' }, { name: 'Lifetime', value: 'lifetime' }),
        )
        .addIntegerOption((o) => o.setName('duration_days').setDescription('Days of access for a monthly key (default 30)').setMinValue(1).setMaxValue(3650))
        .addNumberOption((o) => o.setName('price').setDescription('What this key was sold for, for your own records (optional)').setMinValue(0)),
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('View details for a license key.').addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('revoke')
        .setDescription('Revoke a license key and deactivate premium on its server.')
        .addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('extend')
        .setDescription('Add days to a redeemed monthly license (renewal).')
        .addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true))
        .addIntegerOption((o) => o.setName('days').setDescription('Days to add').setRequired(true).setMinValue(1).setMaxValue(3650)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all license keys.'))
    .addSubcommand((sub) => sub.setName('stats').setDescription('See totals across every license you have generated.')),

  async execute(interaction) {
    const blocked = requireAdminGuild(interaction);
    if (blocked) return interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    if (sub === 'generate') {
      const tier = interaction.options.getString('tier', true);
      const durationDays = tier === 'monthly' ? interaction.options.getInteger('duration_days') ?? 30 : null;
      const price = interaction.options.getNumber('price');
      const key = createLicense(tier, durationDays, interaction.user.id, price);

      const embed = baseEmbed(COLORS.success)
        .setTitle('License key generated')
        .setDescription(`\`${key}\``)
        .addFields(
          { name: 'Tier', value: tier, inline: true },
          { name: 'Duration', value: durationDays ? `${durationDays} day(s) from redemption` : 'Lifetime', inline: true },
        )
        .setFooter({ text: 'Give this key to the customer — they redeem it in their own server with /redeem.' });
      if (price != null) embed.addFields({ name: 'Price', value: `$${price.toFixed(2)}`, inline: true });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'info') {
      const key = interaction.options.getString('key', true);
      const license = getLicense(key);
      if (!license) return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });

      const embed = baseEmbed()
        .setTitle(`License ${key.trim().toUpperCase()}`)
        .addFields(
          { name: 'Tier', value: license.tier, inline: true },
          { name: 'Redeemed', value: license.redeemed ? 'Yes' : 'No', inline: true },
          { name: 'Redeemed by', value: license.redeemedBy ? `<@${license.redeemedBy}>` : 'N/A', inline: true },
          { name: 'Server', value: license.guildId ? `${license.guildId}` : 'N/A', inline: true },
          { name: 'Expires', value: license.expiresAt ? `<t:${Math.floor(license.expiresAt / 1000)}:R>` : license.redeemed ? 'Never' : 'N/A', inline: true },
        );
      if (license.price != null) embed.addFields({ name: 'Price', value: `$${license.price.toFixed(2)}`, inline: true });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'extend') {
      const key = interaction.options.getString('key', true);
      const days = interaction.options.getInteger('days', true);
      const result = extendLicense(key, days);

      if (result.error === 'not_found') return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });
      if (result.error === 'not_redeemed') return interaction.reply({ content: 'That key has not been redeemed yet, so there is nothing to extend.', flags: MessageFlags.Ephemeral });
      if (result.error === 'lifetime') return interaction.reply({ content: 'That is a lifetime license — it never expires, so there is nothing to extend.', flags: MessageFlags.Ephemeral });

      if (result.guildId) {
        const config = getConfig(result.guildId);
        config.premium.active = true;
        config.premium.expiresAt = result.expiresAt;
        config.premium.expiryWarned = false;
        saveConfig(result.guildId);
      }

      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.success)
            .setDescription(`License \`${key.trim().toUpperCase()}\` extended by **${days}** day(s).\nNew expiry: <t:${Math.floor(result.expiresAt / 1000)}:F>`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'revoke') {
      const key = interaction.options.getString('key', true);
      const result = revokeLicense(key);
      if (result.error === 'not_found') return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });

      if (result.guildId) {
        const config = getConfig(result.guildId);
        config.premium = { active: false, tier: null, licenseKey: null, expiresAt: null, expiryWarned: false };
        saveConfig(result.guildId);
      }

      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription(`License \`${key.trim().toUpperCase()}\` revoked${result.guildId ? ' and premium deactivated on its server' : ''}.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'list') {
      const licenses = listLicenses();
      if (licenses.length === 0) return interaction.reply({ content: 'No licenses have been generated yet.', flags: MessageFlags.Ephemeral });

      const lines = licenses
        .slice(0, 25)
        .map((l) => `\`${l.key}\` — ${l.tier} — ${l.redeemed ? `redeemed (guild ${l.guildId})` : 'unredeemed'}${l.price != null ? ` — $${l.price.toFixed(2)}` : ''}`)
        .join('\n');
      const embed = baseEmbed()
        .setTitle(`Licenses (${licenses.length})`)
        .setDescription(lines + (licenses.length > 25 ? `\n...and ${licenses.length - 25} more` : ''));
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'stats') {
      const licenses = listLicenses();
      if (licenses.length === 0) return interaction.reply({ content: 'No licenses have been generated yet.', flags: MessageFlags.Ephemeral });

      const now = Date.now();
      const redeemed = licenses.filter((l) => l.redeemed);
      const active = redeemed.filter((l) => !l.expiresAt || l.expiresAt > now);
      const expired = redeemed.filter((l) => l.expiresAt && l.expiresAt <= now);
      const lifetime = licenses.filter((l) => l.tier === 'lifetime').length;
      const monthly = licenses.filter((l) => l.tier === 'monthly').length;
      const revenue = licenses.reduce((sum, l) => sum + (l.price ?? 0), 0);
      const tracked = licenses.filter((l) => l.price != null).length;

      const embed = baseEmbed(COLORS.primary)
        .setTitle('📊 License stats')
        .addFields(
          { name: 'Total generated', value: `${licenses.length}`, inline: true },
          { name: 'Redeemed', value: `${redeemed.length}`, inline: true },
          { name: 'Unredeemed', value: `${licenses.length - redeemed.length}`, inline: true },
          { name: 'Currently active', value: `${active.length}`, inline: true },
          { name: 'Expired', value: `${expired.length}`, inline: true },
          { name: 'Lifetime / Monthly', value: `${lifetime} / ${monthly}`, inline: true },
        );
      if (tracked > 0) embed.addFields({ name: 'Recorded revenue', value: `$${revenue.toFixed(2)} across ${tracked} key(s) with a price set` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
