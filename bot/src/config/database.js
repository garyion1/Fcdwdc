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
    autorole: null,
    invitedBy: null,
    lastMassDmAt: null,
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

const cache = new Map();

const selectConfigStmt = db.prepare('SELECT config FROM guild_config WHERE guild_id = ?');
const upsertConfigStmt = db.prepare(`
  INSERT INTO guild_config (guild_id, config, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at
`);
const allGuildIdsStmt = db.prepare('SELECT guild_id FROM guild_config');

function getConfig(guildId) {
  if (cache.has(guildId)) return cache.get(guildId);

  let config = defaultConfig();
  const row = selectConfigStmt.get(guildId);

  if (row) {
    try {
      const saved = JSON.parse(row.config);
      config = {
        ...config,
        ...saved,
        automod: { ...config.automod, ...saved.automod },
        antiraid: { ...config.antiraid, ...saved.antiraid },
        premium: { ...config.premium, ...saved.premium },
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

module.exports = { getConfig, saveConfig, defaultConfig, getAllGuildIds };
