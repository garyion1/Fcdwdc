const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

function defaultGuild() {
  return {
    welcomeChannel: null,
    welcomeMessage: "Welcome {user} to {server}! We're now at {membercount} members.",
    leaveChannel: null,
    leaveMessage: '{user} has left {server}.',
    modLogChannel: null,
    ticketCategory: null,
    ticketSupportRole: null,
    automod: { enabled: false, bannedWords: [], blockInvites: false },
    warnings: {},
    customCommands: {},
    reactionRoles: [],
    giveaways: {},
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ guilds: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getGuild(guildId) {
  const data = load();
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = defaultGuild();
    save(data);
  }
  return data.guilds[guildId];
}

function updateGuild(guildId, updater) {
  const data = load();
  if (!data.guilds[guildId]) data.guilds[guildId] = defaultGuild();
  updater(data.guilds[guildId]);
  save(data);
  return data.guilds[guildId];
}

module.exports = { getGuild, updateGuild };
