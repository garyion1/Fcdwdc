const { AuditLogEvent } = require('discord.js');
const { isBotUsable } = require('../utils/premium');
const { handleAntinukeEvent } = require('../utils/antinuke');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!isBotUsable(ban.guild.id)) return;
    await logEvent(ban.guild, 'members', `🔨 **${ban.user.tag}** was banned.`);
    await handleAntinukeEvent(ban.guild, 'ban', AuditLogEvent.MemberBanAdd, ban.user.tag);
  },
};
