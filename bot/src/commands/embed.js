const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { containsBadWord } = require('../utils/profanity');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Build and send a custom embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName('description').setDescription('Embed description').setRequired(true))
    .addStringOption((o) => o.setName('title').setDescription('Embed title'))
    .addStringOption((o) => o.setName('color').setDescription('Hex color, e.g. #5865F2'))
    .addStringOption((o) => o.setName('image').setDescription('Image URL'))
    .addStringOption((o) => o.setName('footer').setDescription('Footer text'))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to send to (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const description = interaction.options.getString('description', true);
    const title = interaction.options.getString('title');
    const color = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const footer = interaction.options.getString('footer');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    if (containsBadWord([title, description, footer].filter(Boolean).join(' '), interaction.guildId)) {
      return interaction.reply({ content: 'That embed contains a blocked word and was not sent.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder().setDescription(description).setColor(COLORS.primary);
    if (title) embed.setTitle(title);
    if (footer) embed.setFooter({ text: footer });
    if (image && /^https?:\/\//i.test(image)) embed.setImage(image);
    if (color && /^#?[0-9a-f]{6}$/i.test(color)) embed.setColor(parseInt(color.replace('#', ''), 16));

    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Embed sent to ${channel}.`, flags: MessageFlags.Ephemeral });
  },
};
