const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const {
  getAdminGuildId,
  getLicenseLogChannel,
  setLicenseLogChannel,
  createLicense,
  getLicense,
  getLicenseDetail,
  revokeLicense,
  extendLicense,
  regenerateLicense,
  listLicenses,
} = require('../utils/licenses');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logLicenseEvent } = require('../utils/licenseLog');

function requireAdminGuild(interaction) {
  const adminGuildId = getAdminGuildId();
  if (interaction.guildId !== adminGuildId) {
    return 'License commands can only be used in the admin/control server. See `/adminserver status` to check which server that is.';
  }
  return null;
}

// Applies a revoked/deactivated key to every guild that held a seat on it.
function deactivateGuilds(guildIds) {
  for (const guildId of guildIds) {
    const config = getConfig(guildId);
    config.premium = { active: false, tier: null, licenseKey: null, expiresAt: null, expiryWarned: false, graceStartedAt: null };
    saveConfig(guildId);
  }
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
        .addIntegerOption((o) => o.setName('seats').setDescription('How many servers this one key can be active in at once (default 1)').setMinValue(1).setMaxValue(100))
        .addNumberOption((o) => o.setName('price').setDescription('What this key was sold for, for your own records (optional)').setMinValue(0)),
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('View details for a license key.').addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('revoke')
        .setDescription('Revoke a license key everywhere it is active.')
        .addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('extend')
        .setDescription('Add days to a redeemed monthly license (renewal).')
        .addStringOption((o) => o.setName('key').setDescription('The license key').setRequired(true))
        .addIntegerOption((o) => o.setName('days').setDescription('Days to add').setRequired(true).setMinValue(1).setMaxValue(3650)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('regenerate')
        .setDescription('Issue a fresh key that replaces a leaked one, keeping its tier, seats, and remaining time.')
        .addStringOption((o) => o.setName('key').setDescription('The old license key').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('logchannel')
        .setDescription('Set (or clear) the channel every redeem/revoke/extend/expiry gets posted to.')
        .addChannelOption((o) => o.setName('channel').setDescription('Leave empty to stop logging').addChannelTypes(ChannelType.GuildText)),
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
      const seats = interaction.options.getInteger('seats') ?? 1;
      const price = interaction.options.getNumber('price');
      const key = createLicense(tier, durationDays, interaction.user.id, price, seats);

      const embed = baseEmbed(COLORS.success)
        .setTitle('License key generated')
        .setDescription(`\`${key}\``)
        .addFields(
          { name: 'Tier', value: tier, inline: true },
          { name: 'Duration', value: durationDays ? `${durationDays} day(s) from redemption` : 'Lifetime', inline: true },
          { name: 'Seats', value: `${seats}`, inline: true },
        )
        .setFooter({ text: 'Give this key to the customer — they redeem it in their own server with /redeem.' });
      if (price != null) embed.addFields({ name: 'Price', value: `$${price.toFixed(2)}`, inline: true });

      await logLicenseEvent(interaction.client, `🆕 \`${key}\` generated by **${interaction.user.tag}** (${tier}, ${seats} seat(s)${price != null ? `, $${price.toFixed(2)}` : ''}).`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'info') {
      const key = interaction.options.getString('key', true);
      const license = getLicenseDetail(key);
      if (!license) return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });

      const embed = baseEmbed()
        .setTitle(`License ${license.key}`)
        .addFields(
          { name: 'Tier', value: license.tier, inline: true },
          { name: 'Seats', value: `${license.seatsUsed} / ${license.seats}`, inline: true },
          { name: 'Expires', value: license.expiresAt ? `<t:${Math.floor(license.expiresAt / 1000)}:R>` : license.redeemed ? 'Never' : 'N/A', inline: true },
          { name: 'Active servers', value: license.activeGuildIds.length > 0 ? license.activeGuildIds.map((id) => `\`${id}\``).join('\n') : 'None' },
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

      for (const guildId of result.guildIds) {
        const config = getConfig(guildId);
        config.premium.active = true;
        config.premium.expiresAt = result.expiresAt;
        config.premium.expiryWarned = false;
        config.premium.graceStartedAt = null;
        saveConfig(guildId);
      }

      await logLicenseEvent(interaction.client, `⏫ \`${key.trim().toUpperCase()}\` extended by **${days}** day(s) by **${interaction.user.tag}** (${result.guildIds.length} server(s) affected).`);

      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.success)
            .setDescription(
              `License \`${key.trim().toUpperCase()}\` extended by **${days}** day(s) across **${result.guildIds.length}** server(s).\nNew expiry: <t:${Math.floor(result.expiresAt / 1000)}:F>`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'revoke') {
      const key = interaction.options.getString('key', true);
      const result = revokeLicense(key);
      if (result.error === 'not_found') return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });

      deactivateGuilds(result.guildIds);
      await logLicenseEvent(
        interaction.client,
        `🚫 \`${key.trim().toUpperCase()}\` revoked by **${interaction.user.tag}** (${result.guildIds.length} server(s) deactivated).`,
        COLORS.danger,
      );

      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            `License \`${key.trim().toUpperCase()}\` revoked${result.guildIds.length > 0 ? ` and premium deactivated on ${result.guildIds.length} server(s)` : ''}.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'regenerate') {
      const key = interaction.options.getString('key', true);
      const result = regenerateLicense(key);
      if (result.error === 'not_found') return interaction.reply({ content: 'No license found with that key.', flags: MessageFlags.Ephemeral });

      for (const guildId of result.guildIds) {
        const config = getConfig(guildId);
        config.premium.licenseKey = result.newKey;
        saveConfig(guildId);
      }

      await logLicenseEvent(
        interaction.client,
        `🔁 \`${key.trim().toUpperCase()}\` regenerated as \`${result.newKey}\` by **${interaction.user.tag}** (${result.guildIds.length} server(s) migrated).`,
      );

      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.success)
            .setTitle('License regenerated')
            .setDescription(`\`${key.trim().toUpperCase()}\` is now invalid.\nNew key: \`${result.newKey}\``)
            .setFooter({ text: 'Give the new key to the customer — the old one no longer works. Servers already using it were migrated automatically.' }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      setLicenseLogChannel(channel?.id ?? null);
      return interaction.reply({
        embeds: [
          baseEmbed(COLORS.success).setDescription(channel ? `License events will now be posted to ${channel}.` : 'License event logging turned off.'),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'list') {
      const licenses = listLicenses();
      if (licenses.length === 0) return interaction.reply({ content: 'No licenses have been generated yet.', flags: MessageFlags.Ephemeral });

      const lines = licenses
        .slice(0, 25)
        .map((l) => `\`${l.key}\` — ${l.tier} — ${l.redeemed ? `redeemed${l.seats > 1 ? ` (${l.seats} seats)` : ''}` : 'unredeemed'}${l.price != null ? ` — $${l.price.toFixed(2)}` : ''}`)
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
      const totalSeats = licenses.reduce((sum, l) => sum + l.seats, 0);

      const embed = baseEmbed(COLORS.primary)
        .setTitle('📊 License stats')
        .addFields(
          { name: 'Total generated', value: `${licenses.length}`, inline: true },
          { name: 'Redeemed', value: `${redeemed.length}`, inline: true },
          { name: 'Unredeemed', value: `${licenses.length - redeemed.length}`, inline: true },
          { name: 'Currently active', value: `${active.length}`, inline: true },
          { name: 'Expired', value: `${expired.length}`, inline: true },
          { name: 'Lifetime / Monthly', value: `${lifetime} / ${monthly}`, inline: true },
          { name: 'Total seats sold', value: `${totalSeats}`, inline: true },
        );
      if (tracked > 0) embed.addFields({ name: 'Recorded revenue', value: `$${revenue.toFixed(2)} across ${tracked} key(s) with a price set` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
