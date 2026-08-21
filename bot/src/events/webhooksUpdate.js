const { AuditLogEvent } = require('discord.js');
const { isBotUsable } = require('../utils/premium');
const { handleAntinukeEvent } = require('../utils/antinuke');

module.exports = {
  name: 'webhooksUpdate',
  async execute(channel) {
    if (!channel.guild || !isBotUsable(channel.guild.id)) return;
    await handleAntinukeEvent(channel.guild, 'webhook', AuditLogEvent.WebhookCreate, `#${channel.name}`);
  },
};
