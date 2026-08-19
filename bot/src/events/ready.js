const { ActivityType } = require('discord.js');
const { getAllGuildIds, getConfig } = require('../config/database');
const { scheduleGiveawayEnd } = require('../commands/giveaway');
const { schedulePurge } = require('../utils/autopurge');
const { isBotUsable } = require('../utils/premium');

const STATUS_ROTATION_MS = 15000;

function totalMembers(client) {
  return client.guilds.cache.reduce((sum, guild) => sum + (guild.memberCount ?? 0), 0);
}

function buildStatuses(client) {
  return [
    { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
    { name: `${totalMembers(client)} members`, type: ActivityType.Watching },
    { name: '/help', type: ActivityType.Listening },
    { name: 'over your tickets', type: ActivityType.Watching },
    { name: 'with slash commands', type: ActivityType.Playing },
  ];
}

function startStatusRotation(client) {
  let index = 0;
  const apply = () => {
    const statuses = buildStatuses(client);
    const status = statuses[index % statuses.length];
    client.user.setActivity(status.name, { type: status.type });
    index += 1;
  };

  apply();
  setInterval(apply, STATUS_ROTATION_MS);
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Boat Bot is online as ${client.user.tag}`);
    startStatusRotation(client);

    for (const guildId of getAllGuildIds()) {
      if (!isBotUsable(guildId)) continue;
      const config = getConfig(guildId);
      for (const [messageId, giveaway] of Object.entries(config.giveaways ?? {})) {
        if (giveaway.ended) continue;
        scheduleGiveawayEnd(client, guildId, messageId, giveaway.endsAt - Date.now());
      }
      for (const [channelId, entry] of Object.entries(config.autopurge ?? {})) {
        schedulePurge(client, guildId, channelId, entry.intervalMinutes);
      }
    }
  },
};
