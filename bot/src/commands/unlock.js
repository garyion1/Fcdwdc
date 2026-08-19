const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { unlockChannel } = require('../utils/channelLock');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to unlock (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    const result = await unlockChannel(channel, interaction.user);
    if (result.notLocked) {
      return interaction.reply({ content: `${channel} is not locked.` });
    }
    return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`🔓 ${channel} is now unlocked.`)] });
  },
};
