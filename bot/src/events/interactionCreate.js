const { ChannelType, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

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
      if (interaction.customId === 'boatbot_open_ticket') {
        await handleOpenTicket(interaction);
      } else if (interaction.customId === 'boatbot_close_ticket') {
        await handleCloseTicket(interaction);
      }
    }
  },
};

async function handleOpenTicket(interaction) {
  const guild = interaction.guild;
  const config = getConfig(guild.id);

  if (!config.ticketCategory) {
    return interaction.reply({ content: 'The ticket system is not configured yet.', flags: MessageFlags.Ephemeral });
  }

  const existing = guild.channels.cache.find((c) => c.parentId === config.ticketCategory && c.topic === interaction.user.id);
  if (existing) {
    return interaction.reply({ content: `You already have an open ticket: ${existing}`, flags: MessageFlags.Ephemeral });
  }

  config.ticketCounter = (config.ticketCounter ?? 0) + 1;
  saveConfig(guild.id);

  const channel = await guild.channels.create({
    name: `ticket-${config.ticketCounter}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategory,
    topic: interaction.user.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ],
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('boatbot_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  );

  await channel.send({
    embeds: [
      baseEmbed()
        .setTitle(`Ticket #${config.ticketCounter}`)
        .setDescription(`Hi ${interaction.user}, support will be with you shortly.\nDescribe your issue below.`),
    ],
    components: [row],
  });

  await interaction.reply({ content: `Ticket created: ${channel}`, flags: MessageFlags.Ephemeral });
}

async function handleCloseTicket(interaction) {
  const channel = interaction.channel;
  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral });
  }
  await interaction.reply({ embeds: [baseEmbed(COLORS.warning).setDescription('This ticket will be closed in 5 seconds...')] });
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}
