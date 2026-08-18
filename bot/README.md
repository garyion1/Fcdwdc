# Boat Bot — Source

This is the bot implementation described in [`docs/boat-bot.md`](../docs/boat-bot.md).

Built with [discord.js](https://discord.js.org) v14. Per-server settings are stored as JSON
files, so no external database is required.

## Requirements

- Node.js 18+
- A Discord application/bot created at the [Discord Developer Portal](https://discord.com/developers/applications)

## Setup

1. Install dependencies:
   ```
   cd bot
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN` — your bot's token (Developer Portal → Bot → Reset Token)
   - `CLIENT_ID` — your application's client ID (Developer Portal → General Information)
   - `GUILD_ID` — optional. Set this during development to deploy slash commands to a single
     server instantly. Leave blank to deploy globally (can take up to an hour to propagate).
3. In the Developer Portal, under **Bot**, enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
4. Invite the bot to your server. The simplest option is the `Administrator` permission
   (required for `/setup`); for a tighter grant, include at least: Manage Roles, Manage
   Channels, Kick Members, Ban Members, Moderate Members, Manage Messages, View Channels,
   Send Messages, Embed Links, Add Reactions.
5. Register the slash commands:
   ```
   npm run deploy
   ```
6. Start the bot:
   ```
   npm start
   ```
7. In your server, run `/setup` to configure welcome/leave/log channels, the ticket
   category, and an autorole. Use `/settings` to fine-tune automod and other options
   afterward.

## Project structure

```
bot/
  index.js              Bot entrypoint
  deploy-commands.js    Registers slash commands with Discord
  src/
    commands/           One file per slash command
    events/              One file per Discord.js gateway event
    handlers/            Loads commands/events into the client
    config/database.js   Per-guild JSON config store (data/guilds/<id>.json)
    utils/                Shared embed styling and mod-log helper
  data/guilds/           Auto-created per-server config files (git-ignored)
```

## Commands

Core commands (see [`docs/boat-bot.md`](../docs/boat-bot.md#commands)):
`/help`, `/setup`, `/config`, `/stats`, `/tickets`, `/moderation`, `/settings`, `/support`

Additional commands covering the rest of the feature list:
`/customcommand` (custom text commands), `/embed` (custom embeds), `/reactionrole`
(reaction roles), `/giveaway` (giveaways)

## Not included

The automated purchasing/licensing system described in the docs (checkout, instant
delivery, linking bot access to a purchase) is a separate backend/e-commerce concern
and is not part of this bot codebase.
