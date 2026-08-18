const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'guilds');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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

function filePath(guildId) {
  return path.join(DATA_DIR, `${guildId}.json`);
}

function getConfig(guildId) {
  if (cache.has(guildId)) return cache.get(guildId);

  const fp = filePath(guildId);
  let config = defaultConfig();

  if (fs.existsSync(fp)) {
    try {
      const saved = JSON.parse(fs.readFileSync(fp, 'utf8'));
      config = {
        ...config,
        ...saved,
        automod: { ...config.automod, ...saved.automod },
        tickets: {
          ...config.tickets,
          ...saved.tickets,
          settings: { ...config.tickets.settings, ...saved.tickets?.settings },
        },
      };
    } catch (error) {
      console.error(`Failed to read config for guild ${guildId}, using defaults:`, error);
    }
  }

  cache.set(guildId, config);
  return config;
}

function saveConfig(guildId) {
  const config = cache.get(guildId);
  if (!config) return;
  fs.writeFileSync(filePath(guildId), JSON.stringify(config, null, 2));
}

function getAllGuildIds() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace('.json', ''));
}

module.exports = { getConfig, saveConfig, defaultConfig, getAllGuildIds };
