const { Client, GatewayIntentBits, Partials, Options } = require('discord.js');
const loadCommands = require('./handlers/commandHandler');
const loadPrefixCommands = require('./handlers/prefixCommandHandler');
const loadEvents = require('./handlers/eventHandler');

// Discord.js caches everything it sees, forever, by default. At a few dozen
// guilds that's free; at a few thousand the member and user caches alone will
// grow past what a normal host gives you and the process starts swapping.
//
// Anything capped here is still reachable — .fetch() goes to the API — so the
// caps trade a little latency on rare lookups for bounded memory. The bot's
// own member/user entry is always kept, since losing it breaks permission
// checks.
function buildCacheOptions() {
  return Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,

    // The two big ones at scale.
    GuildMemberManager: {
      maxSize: Number(process.env.MEMBER_CACHE_MAX) || 200,
      keepOverLimit: (member) => member.id === member.client.user.id,
    },
    UserManager: {
      maxSize: Number(process.env.USER_CACHE_MAX) || 200,
      keepOverLimit: (user) => user.id === user.client.user.id,
    },

    // Snipe keeps its own copy and purge fetches from the API, so a deep
    // message cache buys nothing.
    MessageManager: { maxSize: Number(process.env.MESSAGE_CACHE_MAX) || 50 },

    // Never read anywhere in this bot.
    PresenceManager: 0,
    GuildBanManager: 0,
    GuildInviteManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
    AutoModerationRuleManager: 0,
  });
}

// Caps bound how much is held; sweepers drop what has gone cold so a
// long-running process doesn't sit at its ceiling forever.
function buildSweeperOptions() {
  return {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 300, lifetime: 900 },
    users: {
      interval: 3600,
      filter: () => (user, id) => id !== user.client.user.id,
    },
    guildMembers: {
      interval: 3600,
      filter: () => (member, id) => id !== member.client.user.id,
    },
  };
}

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildExpressions,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildInvites,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    makeCache: buildCacheOptions(),
    sweepers: buildSweeperOptions(),
  });
}

function startBot() {
  const client = createClient();

  loadCommands(client);
  loadPrefixCommands(client);
  loadEvents(client);

  client.login(process.env.DISCORD_TOKEN);
  return client;
}

module.exports = { startBot, createClient };
