const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption((opt) => opt.setName('description').setDescription('Embed description').setRequired(true))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to send to (defaults to this channel)').addChannelTypes(ChannelType.GuildText))
    .addStringOption((opt) => opt.setName('color').setDescription('Hex color, e.g. #5865F2'))
    .addStringOption((opt) => opt.setName('footer').setDescription('Footer text'))
    .addStringOption((opt) => opt.setName('image').setDescription('Image URL')),
  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const image = interaction.options.getString('image');

    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color ?? 0x5865f2);
    if (footer) embed.setFooter({ text: footer });
    if (image) embed.setImage(image);

    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `Embed sent to ${channel}.`, ephemeral: true });
  },
};
