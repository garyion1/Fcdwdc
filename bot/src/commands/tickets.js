const { SlashCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { closeTicket } = require('../utils/tickets');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage the ticket you are currently in.')
    .addSubcommand((sub) => sub.setName('close').setDescription('Close this ticket channel.'))
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Add a user to this ticket.').addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from this ticket.')
        .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);
    const ticket = config.tickets.openTickets[interaction.channel.id];

    if (!ticket) {
      return interaction.reply({ content: 'This command can only be used inside a ticket channel.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'close') {
      if (config.tickets.settings.closeRequireReason) {
        const modal = new ModalBuilder()
          .setCustomId('boatbot_close_reason_modal')
          .setTitle('Close Ticket')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('reason').setLabel('Reason for closing').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200),
            ),
          );
        return interaction.showModal(modal);
      }
      return closeTicket(interaction, null);
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`${user} was added to this ticket.`)] });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`${user} was removed from this ticket.`)] });
    }
  },
};
