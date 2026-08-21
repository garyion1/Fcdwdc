require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, CLEANUP_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    // If a command is ever deployed to BOTH the global scope and a specific
    // guild, Discord shows it twice in that guild's slash-command picker —
    // two separate entries with the same name, each independently clickable.
    // That's the usual cause of "it ran twice" reports for a single click.
    // Deploying to one scope always clears the global scope first, so a
    // leftover registration from an earlier GUILD_ID setting (or lack of
    // one) can never coexist with the current one.
    console.log('Clearing the global command registration to prevent duplicates...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }).catch(() => {});

    if (CLEANUP_GUILD_ID && CLEANUP_GUILD_ID !== GUILD_ID) {
      console.log(`Clearing leftover commands in old guild ${CLEANUP_GUILD_ID}...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, CLEANUP_GUILD_ID), { body: [] }).catch(() => {});
    }

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    console.log(`Deploying ${commands.length} slash commands${GUILD_ID ? ` to guild ${GUILD_ID}` : ' globally'}...`);
    await rest.put(route, { body: commands });
    console.log('Slash commands deployed successfully.');
  } catch (error) {
    console.error('Failed to deploy commands:', error);
    process.exit(1);
  }
})();
