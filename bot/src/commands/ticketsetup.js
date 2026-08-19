const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { slugify, buildPanelComponents } = require('../utils/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Configure the ticket system: types, panels, and behavior.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('addtype')
        .setDescription('Add a ticket type (category button/menu option).')
        .addStringOption((o) => o.setName('label').setDescription('Name shown to users, e.g. "General Support"').setRequired(true))
        .addChannelOption((o) =>
          o
            .setName('category')
            .setDescription('Category tickets of this type are created under (omit to auto-create one named after this type)')
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addRoleOption((o) => o.setName('support_role').setDescription('Role given access to these tickets and pinged on open'))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji for the button/menu option'))
        .addStringOption((o) => o.setName('welcome_message').setDescription('Message sent in new tickets. Use {user} and {type}')),
    )
    .addSubcommand((sub) =>
      sub.setName('removetype').setDescription('Remove a ticket type.').addStringOption((o) => o.setName('label').setDescription('Label of the ticket type to remove').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('listtypes').setDescription('List configured ticket types.'))
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Send the ticket panel to a channel.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to send the panel to').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('title').setDescription('Panel embed title'))
        .addStringOption((o) => o.setName('description').setDescription('Panel embed description'))
        .addStringOption((o) => o.setName('color').setDescription('Hex color, e.g. #5865F2')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('Configure ticket system behavior.')
        .addBooleanOption((o) => o.setName('claim_button').setDescription('Show a Claim button in tickets'))
        .addBooleanOption((o) => o.setName('ping_support_role').setDescription('Ping the support role when a ticket opens'))
        .addIntegerOption((o) => o.setName('max_open_per_user').setDescription('Max open tickets per user (1-10)').setMinValue(1).setMaxValue(10))
        .addChannelOption((o) => o.setName('log_channel').setDescription('Channel for ticket transcripts').addChannelTypes(ChannelType.GuildText))
        .addBooleanOption((o) => o.setName('transcript_on_close').setDescription('Send a transcript to the log channel when a ticket closes'))
        .addBooleanOption((o) => o.setName('require_close_reason').setDescription('Require a reason when closing a ticket'))
        .addStringOption((o) => o.setName('naming_format').setDescription('Ticket channel name format. Use {number} and {username}')),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'addtype') {
      const label = interaction.options.getString('label', true);
      const providedCategory = interaction.options.getChannel('category');
      const supportRole = interaction.options.getRole('support_role');
      const emoji = interaction.options.getString('emoji');
      const welcomeMessage = interaction.options.getString('welcome_message');

      if (Object.keys(config.tickets.types).length >= 25) {
        return interaction.reply({ content: 'You can have at most 25 ticket types (a Discord select menu limit).', flags: MessageFlags.Ephemeral });
      }

      let id = slugify(label);
      let suffix = 2;
      while (config.tickets.types[id]) {
        id = `${slugify(label)}-${suffix}`;
        suffix += 1;
      }

      let categoryId = providedCategory?.id ?? null;
      let createdCategory = false;
      if (!categoryId) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const newCategory = await interaction.guild.channels.create({ name: label, type: ChannelType.GuildCategory });
        categoryId = newCategory.id;
        createdCategory = true;
      }

      config.tickets.types[id] = {
        id,
        label,
        category: categoryId,
        supportRoleId: supportRole?.id ?? null,
        emoji: emoji ?? null,
        welcomeMessage: welcomeMessage ?? null,
      };
      saveConfig(interaction.guildId);

      const description = `Ticket type **${label}** added${createdCategory ? ` — created a new **${label}** category for it` : ''}. Send a panel that includes it with \`/ticketsetup panel\`.`;
      const embed = baseEmbed(COLORS.success).setDescription(description);
      return createdCategory ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'removetype') {
      const label = interaction.options.getString('label', true);
      const entry = Object.values(config.tickets.types).find((t) => t.id === label || t.label.toLowerCase() === label.toLowerCase());
      if (!entry) return interaction.reply({ content: 'No ticket type found with that name.', flags: MessageFlags.Ephemeral });
      delete config.tickets.types[entry.id];
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`Ticket type **${entry.label}** removed.`)], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'listtypes') {
      const types = Object.values(config.tickets.types);
      if (types.length === 0) {
        return interaction.reply({ content: 'No ticket types configured yet. Add one with `/ticketsetup addtype`.', flags: MessageFlags.Ephemeral });
      }
      const embed = baseEmbed()
        .setTitle('Ticket Types')
        .addFields(
          types.map((t) => ({
            name: `${t.emoji ?? '🎫'} ${t.label}`,
            value: `Category: <#${t.category}>\nSupport role: ${t.supportRoleId ? `<@&${t.supportRoleId}>` : 'None'}`,
          })),
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'panel') {
      const types = Object.values(config.tickets.types);
      if (types.length === 0) {
        return interaction.reply({ content: 'Add at least one ticket type first with `/ticketsetup addtype`.', flags: MessageFlags.Ephemeral });
      }
      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title') ?? 'Support Tickets';
      const description = interaction.options.getString('description') ?? 'Select a category below to open a ticket.';
      const color = interaction.options.getString('color');

      const embed = baseEmbed().setTitle(title).setDescription(description);
      if (color && /^#?[0-9a-f]{6}$/i.test(color)) embed.setColor(parseInt(color.replace('#', ''), 16));

      await channel.send({ embeds: [embed], components: buildPanelComponents(types) });
      return interaction.reply({ content: `Ticket panel sent to ${channel}.`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'settings') {
      const settings = config.tickets.settings;
      const claim = interaction.options.getBoolean('claim_button');
      const ping = interaction.options.getBoolean('ping_support_role');
      const maxOpen = interaction.options.getInteger('max_open_per_user');
      const logChannel = interaction.options.getChannel('log_channel');
      const transcript = interaction.options.getBoolean('transcript_on_close');
      const requireReason = interaction.options.getBoolean('require_close_reason');
      const naming = interaction.options.getString('naming_format');

      if (claim !== null) settings.claimEnabled = claim;
      if (ping !== null) settings.pingSupportRole = ping;
      if (maxOpen !== null) settings.maxOpenPerUser = maxOpen;
      if (logChannel) settings.logChannel = logChannel.id;
      if (transcript !== null) settings.transcriptOnClose = transcript;
      if (requireReason !== null) settings.closeRequireReason = requireReason;
      if (naming) settings.namingFormat = naming;
      saveConfig(interaction.guildId);

      const embed = baseEmbed(COLORS.success)
        .setTitle('Ticket settings updated')
        .addFields(
          { name: 'Claim button', value: settings.claimEnabled ? 'On' : 'Off', inline: true },
          { name: 'Ping support role', value: settings.pingSupportRole ? 'On' : 'Off', inline: true },
          { name: 'Max open per user', value: `${settings.maxOpenPerUser}`, inline: true },
          { name: 'Log channel', value: settings.logChannel ? `<#${settings.logChannel}>` : 'Not set', inline: true },
          { name: 'Transcript on close', value: settings.transcriptOnClose ? 'On' : 'Off', inline: true },
          { name: 'Require close reason', value: settings.closeRequireReason ? 'On' : 'Off', inline: true },
          { name: 'Naming format', value: `\`${settings.namingFormat}\``, inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
