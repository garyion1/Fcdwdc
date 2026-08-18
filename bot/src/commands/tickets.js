const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage the ticket system.')
    .addSubcommand((sub) => sub.setName('panel').setDescription('Send the ticket panel to this channel.'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket channel.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'panel') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'You need the **Manage Server** permission to do that.', flags: MessageFlags.Ephemeral });
      }
      if (!config.ticketCategory) {
        return interaction.reply({ content: 'Set a ticket category first with `/setup`.', flags: MessageFlags.Ephemeral });
      }

      const embed = baseEmbed().setTitle('Support Tickets').setDescription('Click the button below to open a private support ticket.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('boatbot_open_ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: 'Ticket panel sent.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'close') {
      const channel = interaction.channel;
      if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: 'This command can only be used inside a ticket channel.', flags: MessageFlags.Ephemeral });
      }
      await interaction.reply({ embeds: [baseEmbed(COLORS.warning).setDescription('This ticket will be closed in 5 seconds...')] });
      setTimeout(() => channel.delete().catch(() => {}), 5000);
    }
  },
};
