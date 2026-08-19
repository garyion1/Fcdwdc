const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { lockChannel } = require('../utils/channelLock');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel — blocks sending messages and creating or using threads.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to lock (defaults to this channel)').addChannelTypes(ChannelType.GuildText))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for locking')),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    const result = await lockChannel(channel, interaction.user, reason);
    if (result.alreadyLocked) {
      return interaction.reply({ content: `${channel} is already locked.` });
    }
    return interaction.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔒 ${channel} is now locked.\nReason: ${reason}`)] });
  },
};
