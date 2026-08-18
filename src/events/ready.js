const { ActivityType } = require('discord.js');
const { getGuild } = require('../database');
const { endGiveaway } = require('../commands/giveaway');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('/help', { type: ActivityType.Listening });

    for (const guild of client.guilds.cache.values()) {
      const settings = getGuild(guild.id);
      for (const [messageId, giveaway] of Object.entries(settings.giveaways)) {
        if (giveaway.ended) continue;
        const remaining = giveaway.endsAt - Date.now();
        if (remaining <= 0) {
          endGiveaway(client, guild.id, messageId);
        } else {
          setTimeout(() => endGiveaway(client, guild.id, messageId), remaining);
        }
      }
    }
  },
};
