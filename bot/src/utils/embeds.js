const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
};

function baseEmbed(color = COLORS.primary) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

module.exports = { COLORS, baseEmbed };
