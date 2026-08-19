const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { containsBadWord } = require('../utils/profanity');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName('message').setDescription('What the bot should say').setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to send to (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const text = interaction.options.getString('message', true);
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    if (containsBadWord(text, interaction.guildId)) {
      return interaction.reply({ content: 'That message contains a blocked word and was not sent.', flags: MessageFlags.Ephemeral });
    }

    await channel.send(text);
    await interaction.reply({ content: `Sent to ${channel}.`, flags: MessageFlags.Ephemeral });
  },
};
