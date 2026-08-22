const { db } = require('./db');

function defaultConfig() {
  return {
    prefixes: ['!', '.', '?', ',', '$'],
    welcomeChannel: null,
    welcomeMessage: 'Welcome {user} to {server}! You are member #{memberCount}.',
    leaveChannel: null,
    leaveMessage: '{user} has left {server}.',
    logChannel: null,
    modLogChannel: null,
    autoroles: [],
    invitedBy: null,
    tempBans: {},
    afk: {},
    staffRoles: [],
    mutedRole: null,
    welcomeMessages: {},
    goodbyeMessages: {},
    boostMessages: {},
    fakePermissions: {},
    aliases: {},
    autoresponders: {},
    invokeMessages: {},
    logEvents: {},
    logIgnored: [],
    counters: {},
    timers: {},
    buttonRoles: {},
    antinuke: {
      enabled: false,
      vanity: false,
      botadd: false,
      ban: false,
      kick: false,
      role: false,
      channel: false,
      emoji: false,
      webhook: false,
      punishment: 'ban',
      admins: [],
      whitelist: [],
      logChannel: null,
    },
    leveling: {
      enabled: false,
      rate: 1,
      message: '{user} reached level **{level}**!',
      messageMode: 'channel',
      channel: null,
      stackRoles: true,
      ignoredChannels: [],
      roles: {},
      users: {},
    },
    starboard: {
      channel: null,
      threshold: 3,
      emoji: '⭐',
      selfStar: false,
      color: null,
      timestamp: true,
      jumpUrl: true,
      attachments: true,
      posts: {},
    },
    bumpReminder: {
      enabled: false,
      channel: null,
      message: '🔔 It has been 2 hours — someone run `/bump` to bump the server!',
      thankYou: '✅ Thanks for bumping! I will remind you again in 2 hours.',
      autoLock: false,
      autoClean: false,
      lastBump: null,
    },
    voicemaster: {
      enabled: false,
      joinChannel: null,
      categoryId: null,
      defaultName: "{user}'s channel",
      defaultBitrate: 64,
      defaultRegion: null,
      joinRole: null,
      active: {},
    },
    boosterRole: {
      enabled: false,
      baseRoleId: null,
      awardRoleId: null,
      roles: {},
    },
    automod: {
      enabled: false,
      filterInvites: false,
      filterLinks: false,
      filterCaps: false,
      filterSpam: false,
      bannedWords: [],
    },
    customCommands: {},
    reactionRoles: {},
    warnings: {},
    giveaways: {},
    locks: {},
    autopurge: {},
    jail: {
      roleId: null,
      channelId: null,
      jailed: {},
    },
    premium: {
      active: false,
      tier: null,
      licenseKey: null,
      expiresAt: null,
      expiryWarned: false,
      graceStartedAt: null,
    },
    antiraid: {
      enabled: false,
      joinThreshold: 5,
      windowSeconds: 10,
      minAccountAgeMinutes: 0,
      action: 'kick',
      lockdownOnRaid: true,
      alertChannel: null,
    },
    tickets: {
      types: {},
      settings: {
        namingFormat: 'ticket-{number}',
        claimEnabled: true,
        pingSupportRole: true,
        maxOpenPerUser: 1,
        logChannel: null,
        transcriptOnClose: true,
        closeRequireReason: false,
      },
      counter: 0,
      openTickets: {},
    },
  };
}

// Configs are cached in memory. With XP moved to its own table a config is
// small (a couple of KB), so the cache is a working-set cache rather than a
// memory emergency — but it still needs a ceiling so a long-running process
// across thousands of guilds doesn't hold every one forever.
//
// Eviction is safe because every mutation is followed by saveConfig, so a
// dropped entry just reloads on the next read. The one hazard is evicting a
// config *between* a caller reading it and saving it — some commands hold one
// across a long await loop. Entries accessed within IDLE_MS are therefore
// never evicted, which covers every such window in this codebase by a wide
// margin, and means the cache settles at "guilds active in the last few
// minutes" rather than "every guild ever seen".
const CACHE_MAX = Number(process.env.CONFIG_CACHE_MAX) || 2000;
const CACHE_IDLE_MS = Number(process.env.CONFIG_CACHE_IDLE_MS) || 5 * 60 * 1000;

const cache = new Map();
const lastTouched = new Map();

function touch(guildId) {
  lastTouched.set(guildId, Date.now());
}

function evictIdle(force = false) {
  if (!force && cache.size <= CACHE_MAX) return 0;

  const now = Date.now();
  const evictable = [...lastTouched.entries()]
    .filter(([, at]) => now - at > CACHE_IDLE_MS)
    .sort((a, b) => a[1] - b[1]);

  // Over the cap, trim back to it; on the idle timer, drop everything cold.
  let budget = force ? evictable.length : cache.size - CACHE_MAX;
  let evicted = 0;

  for (const [guildId] of evictable) {
    if (budget <= 0) break;
    cache.delete(guildId);
    lastTouched.delete(guildId);
    budget -= 1;
    evicted += 1;
  }
  return evicted;
}

// A burst — a mass-join, or a sweep touching many guilds at once — creates
// entries that are all too fresh to evict on the spot. This drains them once
// they go cold, so the cache doesn't simply stay at its high-water mark.
setInterval(() => evictIdle(true), CACHE_IDLE_MS).unref?.();

const selectConfigStmt = db.prepare('SELECT config FROM guild_config WHERE guild_id = ?');
const upsertConfigStmt = db.prepare(`
  INSERT INTO guild_config (guild_id, config, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at
`);
const allGuildIdsStmt = db.prepare('SELECT guild_id FROM guild_config');

function getConfig(guildId) {
  if (cache.has(guildId)) {
    touch(guildId);
    return cache.get(guildId);
  }

  let config = defaultConfig();
  const row = selectConfigStmt.get(guildId);

  if (row) {
    try {
      const saved = JSON.parse(row.config);

      // Pre-multi-role configs stored a single "autorole" role id (or null).
      // Fold it into the new array once so an existing setup isn't lost.
      if (saved.autorole !== undefined && !saved.autoroles) {
        saved.autoroles = saved.autorole ? [{ roleId: saved.autorole, target: 'all' }] : [];
        delete saved.autorole;
      }

      config = {
        ...config,
        ...saved,
        automod: { ...config.automod, ...saved.automod },
        antiraid: { ...config.antiraid, ...saved.antiraid },
        premium: { ...config.premium, ...saved.premium },
        antinuke: { ...config.antinuke, ...saved.antinuke },
        leveling: { ...config.leveling, ...saved.leveling },
        starboard: { ...config.starboard, ...saved.starboard },
        bumpReminder: { ...config.bumpReminder, ...saved.bumpReminder },
        voicemaster: { ...config.voicemaster, ...saved.voicemaster },
        boosterRole: { ...config.boosterRole, ...saved.boosterRole },
        jail: { ...config.jail, ...saved.jail },
        tickets: {
          ...config.tickets,
          ...saved.tickets,
          settings: { ...config.tickets.settings, ...saved.tickets?.settings },
        },
      };
    } catch (error) {
      console.error(`Failed to parse config for guild ${guildId}, using defaults:`, error);
    }
  }

  cache.set(guildId, config);
  touch(guildId);
  evictIdle();
  return config;
}

function saveConfig(guildId) {
  const config = cache.get(guildId);
  if (!config) return;
  upsertConfigStmt.run(guildId, JSON.stringify(config), Date.now());
}

function getAllGuildIds() {
  return allGuildIdsStmt.all().map((row) => row.guild_id);
}

// Returns only the guilds whose stored config actually has something at
// `jsonPath` — a non-empty object/array, or a truthy scalar.
//
// The periodic sweeps used to walk every guild and call getConfig on each,
// which both parsed and cached thousands of configs just to discover that
// almost none of them use the feature. Filtering in SQLite instead keeps a
// sweep proportional to the guilds actually using it.
// json_extract returns a SQLite integer for JSON booleans (0/1) and a text
// blob for objects and arrays, so the "empty" list has to cover both storage
// classes — comparing integer 0 against the string '0' never matches, which
// would let every `false` through.
const guildIdsWithStmt = db.prepare(`
  SELECT guild_id FROM guild_config
  WHERE json_valid(config)
    AND json_extract(config, ?) IS NOT NULL
    AND json_extract(config, ?) NOT IN (0, '{}', '[]', '')
`);

function getGuildIdsWith(jsonPath) {
  try {
    return guildIdsWithStmt.all(jsonPath, jsonPath).map((row) => row.guild_id);
  } catch (error) {
    // JSON1 missing or a malformed path — fall back to every guild rather
    // than silently skipping the feature entirely.
    console.error(`getGuildIdsWith(${jsonPath}) failed, falling back to all guilds:`, error);
    return getAllGuildIds();
  }
}

function cacheStats() {
  return { size: cache.size, max: CACHE_MAX, idleMs: CACHE_IDLE_MS };
}

// Test-only: forces an idle sweep with the age requirement waived.
function _evictAllIdleForTests() {
  for (const guildId of [...lastTouched.keys()]) lastTouched.set(guildId, 0);
  return evictIdle(true);
}

module.exports = { getConfig, saveConfig, defaultConfig, getAllGuildIds, getGuildIdsWith, cacheStats, _evictAllIdleForTests };
