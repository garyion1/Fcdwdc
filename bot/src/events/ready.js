const { ActivityType } = require('discord.js');
const { getAllGuildIds, getConfig } = require('../config/database');
const { scheduleGiveawayEnd } = require('../commands/giveaway');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Boat Bot is online as ${client.user.tag}`);
    client.user.setActivity('/help', { type: ActivityType.Watching });

    for (const guildId of getAllGuildIds()) {
      const config = getConfig(guildId);
      for (const [messageId, giveaway] of Object.entries(config.giveaways ?? {})) {
        if (giveaway.ended) continue;
        scheduleGiveawayEnd(client, guildId, messageId, giveaway.endsAt - Date.now());
      }
    }
  },
};
