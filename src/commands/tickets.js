const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getGuild, updateGuild } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage the ticket system')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configure the ticket system (Manage Server required)')
        .addChannelOption((opt) =>
          opt.setName('category').setDescription('Category tickets are created under').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
        )
        .addRoleOption((opt) => opt.setName('support-role').setDescription('Role that can see and manage tickets').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('open').setDescription('Open a support ticket'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'You need the Manage Server permission to do this.', ephemeral: true });
      }
      const category = interaction.options.getChannel('category');
      const role = interaction.options.getRole('support-role');
      updateGuild(guild.id, (s) => {
        s.ticketCategory = category.id;
        s.ticketSupportRole = role.id;
      });
      return interaction.reply({ content: `Tickets will be created under ${category} and ${role} will have access.`, ephemeral: true });
    }

    if (sub === 'open') {
      const settings = getGuild(guild.id);
      if (!settings.ticketCategory) {
        return interaction.reply({ content: 'Ticket system has not been set up yet. Ask an admin to run `/tickets setup`.', ephemeral: true });
      }

      const channelName = `ticket-${interaction.user.username}`.toLowerCase();
      const existing = guild.channels.cache.find((c) => c.name === channelName && c.parentId === settings.ticketCategory);
      if (existing) {
        return interaction.reply({ content: `You already have an open ticket: ${existing}`, ephemeral: true });
      }

      const overwrites = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      if (settings.ticketSupportRole) {
        overwrites.push({ id: settings.ticketSupportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: settings.ticketCategory,
        permissionOverwrites: overwrites,
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket-close').setLabel('Close ticket').setStyle(ButtonStyle.Danger),
      );
      await channel.send({ content: `${interaction.user} welcome to your ticket. Support will be with you shortly.`, components: [closeRow] });
      return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    }

    if (sub === 'close') {
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: 'This command can only be used inside a ticket channel.', ephemeral: true });
      }
      await interaction.reply('Closing this ticket in 5 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  },
};
