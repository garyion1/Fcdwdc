const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuild } = require('../database');
const { parseEmoji } = require('../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Bind a reaction on a message to a role')
        .addStringOption((opt) => opt.setName('message-id').setDescription('ID of the message to react to (in this channel)').setRequired(true))
        .addStringOption((opt) => opt.setName('emoji').setDescription('Emoji to react with').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to grant').setRequired(true)),
    ),
  async execute(interaction) {
    const messageId = interaction.options.getString('message-id');
    const emojiInput = interaction.options.getString('emoji');
    const role = interaction.options.getRole('role');

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) return interaction.reply({ content: 'Could not find that message in this channel.', ephemeral: true });

    const { key, reactable } = parseEmoji(emojiInput);
    await message.react(reactable).catch(() => null);

    updateGuild(interaction.guild.id, (s) => {
      s.reactionRoles.push({ messageId, channelId: interaction.channel.id, emoji: key, roleId: role.id });
    });

    return interaction.reply({ content: `Reacting with ${emojiInput} on that message now grants ${role}.`, ephemeral: true });
  },
};
