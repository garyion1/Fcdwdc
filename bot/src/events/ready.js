const { ActivityType } = require('discord.js');
const { getAllGuildIds, getConfig } = require('../config/database');
const { getAdminGuildId } = require('../utils/licenses');
const { scheduleGiveawayEnd } = require('../commands/giveaway');
const { schedulePurge } = require('../utils/autopurge');
const { isBotUsable } = require('../utils/premium');
const { INVITER_GRACE_PERIOD_MS, enforceInviterLicense } = require('./guildCreate');

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

    // The inviter-license grace period is only ever scheduled with an
    // in-memory setTimeout, which a process restart silently wipes out. Redo
    // it here on every startup, using Discord's own joinedTimestamp so a
    // restart can't accidentally grant an unlicensed server infinite time.
    const adminGuildId = getAdminGuildId();
    for (const guild of client.guilds.cache.values()) {
      if (guild.id === adminGuildId) continue;
      const config = getConfig(guild.id);
      if (!config.invitedBy) continue;

      const elapsed = Date.now() - guild.joinedTimestamp;
      if (elapsed >= INVITER_GRACE_PERIOD_MS) {
        enforceInviterLicense(guild).catch((error) => console.error('Inviter license check error:', error));
      } else {
        setTimeout(() => {
          enforceInviterLicense(guild).catch((error) => console.error('Inviter license check error:', error));
        }, INVITER_GRACE_PERIOD_MS - elapsed);
      }
    }
  },
};
