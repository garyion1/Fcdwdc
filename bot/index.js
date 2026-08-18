require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const loadCommands = require('./src/handlers/commandHandler');
const loadEvents = require('./src/handlers/eventHandler');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in environment. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
