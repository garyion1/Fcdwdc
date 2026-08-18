const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Manage Boat Bot settings.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('automod')
        .setDescription('Toggle automod features.')
        .addStringOption((o) =>
          o
            .setName('feature')
            .setDescription('Automod feature')
            .setRequired(true)
            .addChoices(
              { name: 'Everything', value: 'enabled' },
              { name: 'Invite links', value: 'filterInvites' },
              { name: 'All links', value: 'filterLinks' },
              { name: 'Excessive caps', value: 'filterCaps' },
              { name: 'Spam', value: 'filterSpam' },
            ),
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn this feature on or off').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('welcome')
        .setDescription('Configure welcome messages.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message').setDescription('Welcome message. Use {user}, {server}, {memberCount}')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('leave')
        .setDescription('Configure leave messages.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for leave messages').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message').setDescription('Leave message. Use {user}, {server}, {memberCount}')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('logs')
        .setDescription('Configure the logging channel.')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for server logs').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autorole')
        .setDescription('Set the role given automatically to new members.')
        .addRoleOption((o) => o.setName('role').setDescription('Role to assign, or omit to disable')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('prefix')
        .setDescription('Add, remove, or list the prefixes used for text commands.')
        .addStringOption((o) =>
          o
            .setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }, { name: 'List', value: 'list' }),
        )
        .addStringOption((o) => o.setName('value').setDescription('The prefix, e.g. ! or , (max 5 characters, no spaces)')),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'automod') {
      const feature = interaction.options.getString('feature', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      if (feature === 'enabled') {
        config.automod.enabled = enabled;
      } else {
        config.automod[feature] = enabled;
      }
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`Automod \`${feature}\` set to **${enabled}**.`)] });
    }

    if (sub === 'welcome') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      if (channel) config.welcomeChannel = channel.id;
      if (message) config.welcomeMessage = message;
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription('Welcome message settings updated.')] });
    }

    if (sub === 'leave') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      if (channel) config.leaveChannel = channel.id;
      if (message) config.leaveMessage = message;
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription('Leave message settings updated.')] });
    }

    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel', true);
      config.logChannel = channel.id;
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`Server logs will now be sent to ${channel}.`)] });
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      config.autorole = role ? role.id : null;
      saveConfig(interaction.guildId);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription(role ? `New members will automatically receive ${role}.` : 'Autorole disabled.')],
      });
    }

    if (sub === 'prefix') {
      const action = interaction.options.getString('action', true);
      const value = interaction.options.getString('value');

      if (action === 'list') {
        return interaction.reply({ content: `Current prefixes: ${config.prefixes.map((p) => `\`${p}\``).join(', ')}`, flags: MessageFlags.Ephemeral });
      }

      if (!value || value.length > 5 || /\s/.test(value)) {
        return interaction.reply({ content: 'Provide a short prefix with no spaces (max 5 characters).', flags: MessageFlags.Ephemeral });
      }

      if (action === 'add') {
        if (config.prefixes.includes(value)) {
          return interaction.reply({ content: `\`${value}\` is already a prefix.`, flags: MessageFlags.Ephemeral });
        }
        config.prefixes.push(value);
      } else {
        if (config.prefixes.length <= 1) {
          return interaction.reply({ content: 'You must keep at least one prefix.', flags: MessageFlags.Ephemeral });
        }
        config.prefixes = config.prefixes.filter((p) => p !== value);
      }
      saveConfig(interaction.guildId);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription(`Prefixes updated: ${config.prefixes.map((p) => `\`${p}\``).join(', ')}`)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
