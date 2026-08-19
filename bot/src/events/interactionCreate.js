const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { openTicket, claimTicket, closeTicket } = require('../utils/tickets');
const { isBotUsable } = require('../utils/premium');

// These stay usable even without an active license — they're how a server
// gets premium in the first place, or gets help/support while it doesn't.
const PREMIUM_EXEMPT_COMMANDS = new Set(['help', 'premium', 'redeem', 'support', 'license', 'adminserver']);
const NO_LICENSE_MESSAGE =
  'This server does not have an active Boat Bot license. Run `/redeem <key>` to activate premium, or `/premium` to check status.';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      if (!PREMIUM_EXEMPT_COMMANDS.has(interaction.commandName) && !isBotUsable(interaction.guildId)) {
        return interaction.reply({ content: NO_LICENSE_MESSAGE, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
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
      if (!isBotUsable(interaction.guild?.id)) {
        return interaction.reply({ content: NO_LICENSE_MESSAGE, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
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
      if (!isBotUsable(interaction.guild?.id)) {
        return interaction.reply({ content: NO_LICENSE_MESSAGE, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return openTicket(interaction, interaction.values[0]);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'boatbot_close_reason_modal') {
      if (!isBotUsable(interaction.guild?.id)) {
        return interaction.reply({ content: NO_LICENSE_MESSAGE, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const reason = interaction.fields.getTextInputValue('reason');
      return closeTicket(interaction, reason);
    }
  },
};
