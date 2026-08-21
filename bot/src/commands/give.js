const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createLicense } = require('../utils/licenses');
const { requireAdminGuild } = require('./license');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logLicenseEvent } = require('../utils/licenseLog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Generate a license key and DM it straight to a member (admin server only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) => o.setName('user').setDescription('Member to send the key to').setRequired(true))
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

  async execute(interaction) {
    const blocked = requireAdminGuild(interaction);
    if (blocked) return interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user', true);
    const tier = interaction.options.getString('tier', true);
    const durationDays = tier === 'monthly' ? interaction.options.getInteger('duration_days') ?? 30 : null;
    const seats = interaction.options.getInteger('seats') ?? 1;
    const price = interaction.options.getNumber('price');
    const key = createLicense(tier, durationDays, interaction.user.id, price, seats);

    const dmEmbed = baseEmbed(COLORS.success)
      .setTitle('🔑 Your Boat Bot license key')
      .setDescription(`\`${key}\``)
      .addFields(
        { name: 'Tier', value: tier, inline: true },
        { name: 'Duration', value: durationDays ? `${durationDays} day(s) from redemption` : 'Lifetime', inline: true },
      )
      .setFooter({ text: 'Redeem it with /redeem <key> in your own server to activate premium.' });

    const dmSent = await user
      .send({ embeds: [dmEmbed] })
      .then(() => true)
      .catch(() => false);

    const embed = baseEmbed(dmSent ? COLORS.success : COLORS.warning)
      .setTitle('License key generated')
      .setDescription(`\`${key}\``)
      .addFields(
        { name: 'Tier', value: tier, inline: true },
        { name: 'Duration', value: durationDays ? `${durationDays} day(s) from redemption` : 'Lifetime', inline: true },
        { name: 'Sent to', value: `${user}`, inline: true },
        { name: 'DM delivered', value: dmSent ? 'Yes' : 'No — their DMs are closed, send it to them manually', inline: true },
      );
    if (seats > 1) embed.addFields({ name: 'Seats', value: `${seats}`, inline: true });

    await logLicenseEvent(interaction.client, `🎁 \`${key}\` generated and given to **${user.tag}** by **${interaction.user.tag}** (${tier}, ${seats} seat(s)).`);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
