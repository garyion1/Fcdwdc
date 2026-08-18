const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../database');

async function logAction(guild, { title, description, color = 0x5865f2 }) {
  const settings = getGuild(guild.id);
  if (!settings.modLogChannel) return;
  const channel = guild.channels.cache.get(settings.modLogChannel);
  if (!channel) return;
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { logAction };
