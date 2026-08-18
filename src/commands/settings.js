const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../database');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Manage bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName('automod')
        .setDescription('Configure automod')
        .addSubcommand((sub) =>
          sub.setName('toggle').setDescription('Enable or disable automod').addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable automod').setRequired(true)),
        )
        .addSubcommand((sub) => sub.setName('add-word').setDescription('Add a banned word').addStringOption((opt) => opt.setName('word').setDescription('Word to ban').setRequired(true)))
        .addSubcommand((sub) =>
          sub.setName('remove-word').setDescription('Remove a banned word').addStringOption((opt) => opt.setName('word').setDescription('Word to unban').setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('block-invites')
            .setDescription('Toggle blocking Discord invite links')
            .addBooleanOption((opt) => opt.setName('enabled').setDescription('Block invite links').setRequired(true)),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('customcommand')
        .setDescription('Manage custom text commands')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add a custom command')
            .addStringOption((opt) => opt.setName('trigger').setDescription('Word that triggers the response').setRequired(true))
            .addStringOption((opt) => opt.setName('response').setDescription('Response the bot sends').setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub.setName('remove').setDescription('Remove a custom command').addStringOption((opt) => opt.setName('trigger').setDescription('Trigger to remove').setRequired(true)),
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('List all custom commands')),
    ),
  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (group === 'automod') {
      if (sub === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        updateGuild(guildId, (s) => (s.automod.enabled = enabled));
        return interaction.reply({ content: `Automod ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
      }
      if (sub === 'add-word') {
        const word = interaction.options.getString('word').toLowerCase();
        updateGuild(guildId, (s) => {
          if (!s.automod.bannedWords.includes(word)) s.automod.bannedWords.push(word);
        });
        return interaction.reply({ content: `Added "${word}" to the banned word list.`, ephemeral: true });
      }
      if (sub === 'remove-word') {
        const word = interaction.options.getString('word').toLowerCase();
        updateGuild(guildId, (s) => (s.automod.bannedWords = s.automod.bannedWords.filter((w) => w !== word)));
        return interaction.reply({ content: `Removed "${word}" from the banned word list.`, ephemeral: true });
      }
      if (sub === 'block-invites') {
        const enabled = interaction.options.getBoolean('enabled');
        updateGuild(guildId, (s) => (s.automod.blockInvites = enabled));
        return interaction.reply({ content: `Blocking invite links is now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
      }
    }

    if (group === 'customcommand') {
      if (sub === 'add') {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        const response = interaction.options.getString('response');
        updateGuild(guildId, (s) => (s.customCommands[trigger] = response));
        return interaction.reply({ content: `Custom command "${trigger}" added.`, ephemeral: true });
      }
      if (sub === 'remove') {
        const trigger = interaction.options.getString('trigger').toLowerCase();
        updateGuild(guildId, (s) => delete s.customCommands[trigger]);
        return interaction.reply({ content: `Custom command "${trigger}" removed.`, ephemeral: true });
      }
      if (sub === 'list') {
        const settings = getGuild(guildId);
        const entries = Object.keys(settings.customCommands);
        if (entries.length === 0) return interaction.reply({ content: 'No custom commands set up yet.', ephemeral: true });
        const embed = baseEmbed().setTitle('Custom commands').setDescription(entries.map((t) => `\`${t}\` -> ${settings.customCommands[t]}`).join('\n'));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
