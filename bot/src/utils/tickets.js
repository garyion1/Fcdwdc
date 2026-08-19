const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('./embeds');

function slugify(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || `type-${Date.now()}`;
}

function buildPanelComponents(types) {
  if (types.length === 1) {
    const type = types[0];
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`boatbot_open_ticket:${type.id}`)
          .setLabel(`Open ${type.label}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(type.emoji || '🎫'),
      ),
    ];
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId('boatbot_open_ticket_select')
    .setPlaceholder('Select a ticket type...')
    .addOptions(types.map((t) => ({ label: t.label, value: t.id, description: t.description || undefined, emoji: t.emoji || undefined })));
  return [new ActionRowBuilder().addComponents(menu)];
}

function buildTicketControls(settings) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('boatbot_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  );
  if (settings.claimEnabled) {
    row.addComponents(new ButtonBuilder().setCustomId('boatbot_claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji('🙋'));
  }
  return [row];
}

function ticketChannelName(settings, counter, member) {
  const username = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
  return settings.namingFormat
    .replaceAll('{number}', `${counter}`)
    .replaceAll('{username}', username)
    .toLowerCase()
    .slice(0, 90);
}

async function openTicket(interaction, typeId) {
  const guild = interaction.guild;
  const config = getConfig(guild.id);
  const type = config.tickets.types[typeId];
  if (!type) {
    return interaction.reply({ content: 'That ticket type no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const openCount = Object.values(config.tickets.openTickets).filter((t) => t.userId === interaction.user.id).length;
  if (openCount >= config.tickets.settings.maxOpenPerUser) {
    return interaction.reply({ content: `You already have ${openCount} open ticket(s), which is the limit here.`, flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  config.tickets.counter += 1;
  const member = await guild.members.fetch(interaction.user.id);
  const name = ticketChannelName(config.tickets.settings, config.tickets.counter, member);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  if (type.supportRoleId) {
    overwrites.push({
      id: type.supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: type.category,
    topic: `${interaction.user.id}|${typeId}`,
    permissionOverwrites: overwrites,
  });

  config.tickets.openTickets[channel.id] = { userId: interaction.user.id, typeId, claimedBy: null, openedAt: Date.now() };
  saveConfig(guild.id);

  const welcome = (type.welcomeMessage || 'Hi {user}, support will be with you shortly. Describe your issue below.')
    .replaceAll('{user}', `${interaction.user}`)
    .replaceAll('{type}', type.label);

  const pingContent = config.tickets.settings.pingSupportRole && type.supportRoleId ? `<@&${type.supportRoleId}>` : undefined;

  await channel.send({
    content: pingContent,
    embeds: [baseEmbed().setTitle(`${type.label} — Ticket #${config.tickets.counter}`).setDescription(welcome)],
    components: buildTicketControls(config.tickets.settings),
  });

  await interaction.editReply(`Ticket created: ${channel}`);
}

async function claimTicket(interaction) {
  const config = getConfig(interaction.guild.id);
  const ticket = config.tickets.openTickets[interaction.channel.id];
  if (!ticket) return interaction.reply({ content: 'This is not an active ticket channel.', flags: MessageFlags.Ephemeral });
  if (ticket.claimedBy) {
    return interaction.reply({ content: `This ticket is already claimed by <@${ticket.claimedBy}>.`, flags: MessageFlags.Ephemeral });
  }

  ticket.claimedBy = interaction.user.id;
  saveConfig(interaction.guild.id);

  await interaction.reply({ embeds: [baseEmbed(COLORS.primary).setDescription(`🙋 Claimed by ${interaction.user}.`)] });
}

async function sendTranscript(channel, config, ticket, closer, reason) {
  const logChannel = config.tickets.settings.logChannel ? channel.guild.channels.cache.get(config.tickets.settings.logChannel) : null;
  if (!logChannel) return;

  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return;

  const lines = [...messages.values()]
    .reverse()
    .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[embed/attachment]'}`);
  const transcript = lines.join('\n') || 'No messages.';
  const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `${channel.name}-transcript.txt` });

  await logChannel
    .send({
      embeds: [
        baseEmbed()
          .setTitle(`Ticket closed: ${channel.name}`)
          .addFields(
            { name: 'Opened by', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Closed by', value: `${closer}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: true },
          ),
      ],
      files: [attachment],
    })
    .catch(() => {});
}

async function closeTicket(interaction, reason) {
  const guild = interaction.guild;
  const config = getConfig(guild.id);
  const channel = interaction.channel;
  const ticket = config.tickets.openTickets[channel.id];
  if (!ticket) {
    return interaction.reply({ content: 'This is not an active ticket channel.', flags: MessageFlags.Ephemeral });
  }

  await interaction.reply({
    embeds: [baseEmbed(COLORS.warning).setDescription(`This ticket will close in 5 seconds...${reason ? `\nReason: ${reason}` : ''}`)],
  });

  if (config.tickets.settings.transcriptOnClose) {
    await sendTranscript(channel, config, ticket, interaction.user, reason);
  }

  delete config.tickets.openTickets[channel.id];
  saveConfig(guild.id);

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports = { slugify, buildPanelComponents, buildTicketControls, openTicket, claimTicket, closeTicket };
