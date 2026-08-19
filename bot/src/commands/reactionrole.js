const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Bind an emoji reaction to a role on a message.')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the message to react to').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role to grant').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a reaction role binding.')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the message').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji bound to the role').setRequired(true)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);
    const messageId = interaction.options.getString('message_id', true).trim();
    const emoji = interaction.options.getString('emoji', true).trim();

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return interaction.reply({ content: 'Could not find that message in this channel.' });
      }
      await message.react(emoji).catch(() => null);

      if (!config.reactionRoles[messageId]) config.reactionRoles[messageId] = {};
      config.reactionRoles[messageId][emoji] = role.id;
      saveConfig(interaction.guildId);

      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription(`Reacting with ${emoji} on that message now grants ${role}.`)]
      });
    }

    if (sub === 'remove') {
      if (config.reactionRoles[messageId]?.[emoji]) {
        delete config.reactionRoles[messageId][emoji];
        saveConfig(interaction.guildId);
        return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription('Reaction role binding removed.')] });
      }
      return interaction.reply({ content: 'No reaction role binding found for that message and emoji.' });
    }
  },
};
