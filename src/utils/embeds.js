const { EmbedBuilder } = require('discord.js');

function baseEmbed() {
  return new EmbedBuilder().setColor(0x5865f2).setTimestamp();
}

module.exports = { baseEmbed };
