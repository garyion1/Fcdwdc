const { getConfig, saveConfig, getGuildIdsWith } = require('../config/database');

// Discord rate-limits channel renames hard (2 per 10 minutes), so counters are
// refreshed on a timer rather than on every join/leave.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const COUNTER_TYPES = ['members', 'humans', 'bots', 'boosts', 'roles', 'channels'];

// Member caching is capped for scale, so a humans/bots split can't be read
// off the cache — those two types fetch the member list for that guild
// first. Only guilds that actually configured such a counter reach here.
function needsMemberList(type) {
  return type === 'humans' || type === 'bots';
}

function counterValue(guild, type) {
  switch (type) {
    case 'humans':
      return guild.members.cache.filter((m) => !m.user.bot).size || guild.memberCount;
    case 'bots':
      return guild.members.cache.filter((m) => m.user.bot).size;
    case 'boosts':
      return guild.premiumSubscriptionCount ?? 0;
    case 'roles':
      return guild.roles.cache.size;
    case 'channels':
      return guild.channels.cache.filter((c) => !c.isThread()).size;
    default:
      return guild.memberCount;
  }
}

async function refreshCounters(client) {
  // Previously this walked every guild the bot is in and called getConfig on
  // each, which parsed and cached thousands of configs to find the handful
  // that use counters. Ask the database for those directly instead.
  for (const guildId of getGuildIdsWith('$.counters')) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const config = getConfig(guild.id);
    let dirty = false;

    const counters = Object.entries(config.counters);
    if (counters.some(([, counter]) => needsMemberList(counter.type))) {
      await guild.members.fetch().catch(() => {});
    }

    for (const [channelId, counter] of counters) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        delete config.counters[channelId];
        dirty = true;
        continue;
      }
      const name = counter.format.replace(/{count}/g, counterValue(guild, counter.type));
      if (channel.name !== name) await channel.setName(name, 'Counter refresh').catch(() => {});
    }

    if (dirty) saveConfig(guild.id);
  }
}

function startCounterRefresh(client) {
  refreshCounters(client).catch((error) => console.error('Counter refresh error:', error));
  setInterval(() => {
    refreshCounters(client).catch((error) => console.error('Counter refresh error:', error));
  }, REFRESH_INTERVAL_MS);
}

module.exports = { startCounterRefresh, refreshCounters, counterValue, COUNTER_TYPES, REFRESH_INTERVAL_MS };
