const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customcommand')
    .setDescription('Create custom text commands for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a custom command.')
        .addStringOption((o) => o.setName('name').setDescription('Command trigger (without prefix)').setRequired(true))
        .addStringOption((o) => o.setName('response').setDescription('Text the bot replies with').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a custom command.')
        .addStringOption((o) => o.setName('name').setDescription('Command trigger to remove').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all custom commands.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'add') {
      const name = interaction.options.getString('name', true).toLowerCase().trim();
      const response = interaction.options.getString('response', true);
      if (interaction.client.prefixCommands.has(name)) {
        return interaction.reply({ content: `\`${name}\` is already a built-in command name. Pick a different name.`, flags: MessageFlags.Ephemeral });
      }
      config.customCommands[name] = response;
      saveConfig(interaction.guildId);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription(`Custom command created. Trigger it with any prefix, e.g. \`${config.prefixes[0]}${name}\`.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name', true).toLowerCase().trim();
      if (!config.customCommands[name]) {
        return interaction.reply({ content: `No custom command named \`${name}\` exists.`, flags: MessageFlags.Ephemeral });
      }
      delete config.customCommands[name];
      saveConfig(interaction.guildId);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`Custom command \`${name}\` removed.`)], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'list') {
      const names = Object.keys(config.customCommands);
      if (names.length === 0) {
        return interaction.reply({ content: 'No custom commands have been created yet.', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({
        embeds: [baseEmbed().setTitle('Custom Commands').setDescription(names.map((n) => `\`${n}\``).join(', '))],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
