const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { openTicket, claimTicket, closeTicket } = require('../utils/tickets');
const { isBotUsable } = require('../utils/premium');

// These stay usable even without an active license — they're how a server
// gets premium in the first place, or gets help/support while it doesn't.
const PREMIUM_EXEMPT_COMMANDS = new Set(['help', 'premium', 'redeem', 'support', 'license', 'mylicense', 'adminserver', 'invite', 'discord']);
const NO_LICENSE_MESSAGE =
  'This server does not have an active Boat Bot license. Run `/redeem <key>` to activate premium, or `/premium` to check status.';

// Every Discord interaction carries a unique ID. Under a host restart mid-
// gateway-session, or a WebSocket resume, Discord can occasionally redeliver
// one — without this, that redelivery would run the command a second time
// (a second license key DM, a second ban, etc). A short window is enough:
// a real duplicate delivery lands within seconds, not minutes.
const recentInteractionIds = new Map();
const DEDUPE_WINDOW_MS = 30000;

function isDuplicateInteraction(interaction) {
  const now = Date.now();
  for (const [id, seenAt] of recentInteractionIds) {
    if (now - seenAt > DEDUPE_WINDOW_MS) recentInteractionIds.delete(id);
  }
  if (recentInteractionIds.has(interaction.id)) return true;
  recentInteractionIds.set(interaction.id, now);
  return false;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (isDuplicateInteraction(interaction)) {
      console.warn(`Ignored a duplicate delivery of interaction ${interaction.id} (${interaction.commandName ?? interaction.customId ?? 'unknown'}).`);
      return;
    }

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
      if (interaction.customId.startsWith('boatbot_buttonrole:')) {
        const roleId = interaction.customId.split(':')[1];
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.reply({ content: 'That role no longer exists.', flags: MessageFlags.Ephemeral }).catch(() => {});
        if (!role.editable) {
          return interaction.reply({ content: 'I cannot assign that role — my role needs to be above it.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        const has = interaction.member.roles.cache.has(roleId);
        if (has) await interaction.member.roles.remove(role, 'Button role').catch(() => {});
        else await interaction.member.roles.add(role, 'Button role').catch(() => {});

        return interaction
          .reply({ content: has ? `Removed ${role}.` : `Gave you ${role}.`, flags: MessageFlags.Ephemeral })
          .catch(() => {});
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
