const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { openTicket, claimTicket, closeTicket } = require('../utils/tickets');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const payload = { content: 'Something went wrong while running that command.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('boatbot_open_ticket:')) {
        const typeId = interaction.customId.split(':')[1];
        return openTicket(interaction, typeId);
      }
      if (interaction.customId === 'boatbot_claim_ticket') {
        return claimTicket(interaction);
      }
      if (interaction.customId === 'boatbot_close_ticket') {
        const config = getConfig(interaction.guild.id);
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
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'boatbot_open_ticket_select') {
      return openTicket(interaction, interaction.values[0]);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'boatbot_close_reason_modal') {
      const reason = interaction.fields.getTextInputValue('reason');
      return closeTicket(interaction, reason);
    }
  },
};
