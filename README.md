# Boat Bot

See [docs/boat-bot.md](docs/boat-bot.md) for full details on Boat Bot — features, pricing, commands, and support.

## Running the bot

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID` from the
   [Discord Developer Portal](https://discord.com/developers/applications). Set `GUILD_ID`
   too if you want commands to register instantly to a single test server while developing.
3. Register the slash commands:
   ```
   npm run deploy
   ```
4. Start the bot:
   ```
   npm start
   ```

Per-server configuration (welcome/leave channels, automod, tickets, custom commands, warnings,
reaction roles, giveaways) is stored in `data/database.json`, which is created automatically on
first run and is git-ignored.

### Project structure

- `src/index.js` — bot entry point, loads commands and events
- `src/deploy-commands.js` — registers slash commands with Discord
- `src/commands/` — one file per slash command (`/help`, `/setup`, `/config`, `/stats`,
  `/tickets`, `/moderation`, `/settings`, `/support`, plus `/giveaway`, `/embed`, and
  `/reactionrole` for the giveaway, custom embed, and reaction role features)
- `src/events/` — Discord gateway event handlers (ready, interactions, member join/leave,
  message automod, reaction roles)
- `src/database.js` — JSON-file-backed per-guild settings store
