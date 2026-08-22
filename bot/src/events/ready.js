const { ActivityType } = require('discord.js');
const { getConfig, getGuildIdsWith } = require('../config/database');
const { getAdminGuildId } = require('../utils/licenses');
const { scheduleGiveawayEnd } = require('../commands/giveaway');
const { schedulePurge } = require('../utils/autopurge');
const { isBotUsable } = require('../utils/premium');
const { INVITER_GRACE_PERIOD_MS, enforceInviterLicense } = require('./guildCreate');
const { scheduleTempBan, liftTempBan } = require('../utils/tempban');
const { scheduleTimer } = require('../utils/timers');
const { startCounterRefresh } = require('../utils/counters');
const { pruneTempChannels } = require('../utils/voicemaster');
const { restoreBumpReminders } = require('../utils/bumpReminder');
const { startLicenseExpirySweep } = require('../utils/licenseExpiry');
const { startGifCacheWarmer } = require('../utils/gifCache');

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
    client.user.setPresence({ status: 'dnd', activities: [{ name: status.name, type: status.type }] });
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

    // Only guilds that actually have something scheduled — walking every
    // guild here would parse and cache thousands of configs at boot just to
    // find the few with a pending giveaway or timer.
    const scheduled = new Set([
      ...getGuildIdsWith('$.giveaways'),
      ...getGuildIdsWith('$.autopurge'),
      ...getGuildIdsWith('$.tempBans'),
      ...getGuildIdsWith('$.timers'),
    ]);

    for (const guildId of scheduled) {
      // Under sharding every shard reads the same database, so without this
      // each one would schedule the same giveaway end and temp-ban lift and
      // they'd all fire. A guild lives on exactly one shard.
      if (!client.guilds.cache.has(guildId)) continue;
      if (!isBotUsable(guildId)) continue;
      const config = getConfig(guildId);
      for (const [messageId, giveaway] of Object.entries(config.giveaways ?? {})) {
        if (giveaway.ended) continue;
        scheduleGiveawayEnd(client, guildId, messageId, giveaway.endsAt - Date.now());
      }
      for (const [channelId, entry] of Object.entries(config.autopurge ?? {})) {
        schedulePurge(client, guildId, channelId, entry.intervalMinutes);
      }
      for (const [userId, tempBan] of Object.entries(config.tempBans ?? {})) {
        const remaining = tempBan.expiresAt - Date.now();
        if (remaining <= 0) {
          liftTempBan(client, guildId, userId).catch((error) => console.error('Temp-ban lift error:', error));
        } else {
          scheduleTempBan(client, guildId, userId, remaining);
        }
      }
      for (const [channelId, timer] of Object.entries(config.timers ?? {})) {
        scheduleTimer(client, guildId, channelId, timer.intervalMinutes);
      }
    }

    startCounterRefresh(client);
    restoreBumpReminders(client);
    startLicenseExpirySweep(client);
    // Global data shared through the database — only one shard needs to
    // refresh it.
    if (!client.shard || client.shard.ids.includes(0)) startGifCacheWarmer();
    pruneTempChannels(client).catch((error) => console.error('VoiceMaster prune error:', error));

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
