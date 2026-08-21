const { AuditLogEvent } = require('discord.js');
const { isBotUsable } = require('../utils/premium');
const { handleAntinukeEvent } = require('../utils/antinuke');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild || !isBotUsable(channel.guild.id)) return;
    await logEvent(channel.guild, 'channels', `🗑️ Channel **#${channel.name}** was deleted.`);
    await handleAntinukeEvent(channel.guild, 'channel', AuditLogEvent.ChannelDelete, `#${channel.name}`);
  },
};
