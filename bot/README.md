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
  index.js               Bot entrypoint
  deploy-commands.js     Registers slash commands with Discord
  src/
    commands/             One file per slash command
    prefixCommands/        Text (prefix) commands, grouped by category per file
    events/                 One file per Discord.js gateway event
    handlers/               Loads slash commands, prefix commands, and events into the client
    config/database.js      Per-guild JSON config store (data/guilds/<id>.json)
    utils/
      embeds.js              Shared embed styling
      logger.js              Mod-log channel helper
      args.js                Resolve a @mention or ID to a user
      channelLock.js         Lock/unlock a channel, including active threads
      tickets.js              Ticket open/claim/close, transcripts, panel builders
  data/guilds/             Auto-created per-server config files (git-ignored)
```

## Commands

Core slash commands (see [`docs/boat-bot.md`](../docs/boat-bot.md#commands)):
`/help`, `/setup`, `/config`, `/stats`, `/tickets`, `/moderation`, `/settings`, `/support`

Additional slash commands:
`/ticketsetup` (configure ticket types/panels/behavior), `/lock` / `/unlock` (channel
lock that also blocks and locks threads), `/autopurge` (schedule a channel to
auto-clean on a repeating interval), `/customcommand`, `/embed`, `/reactionrole`,
`/giveaway`

### Text (prefix) commands

The bot also responds to plain text commands using any of a server's configured
prefixes (default: `!` `.` `?` `,` `$` — manage them with `/settings prefix`). Run
`!commands` in a server for the full grouped list. Built-in categories:

- **Moderation** — `lock`, `unlock`, `kick`, `ban`, `unban`, `timeout`/`mute`,
  `untimeout`/`unmute`, `warn`, `warnings`, `warnclear`, `clear`/`purge`, `purgeuser`,
  `purgebots`, `autopurge`, `slowmode`, `nick`
- **Utility** — `ping`, `avatar`, `userinfo`/`whois`, `serverinfo`/`guildinfo`,
  `roleinfo`, `banner`, `invite`, `botinfo`/`about`, `uptime`, `prefix`,
  `channelinfo`, `membercount`, `id`, `firstmessage`/`firstmsg`, `emojis`
- **Fun** — `8ball`, `coinflip`/`flip`, `roll`, `rps`, `poll`, `remind`, `hug`, `kiss`
  (`hug`/`kiss` send a reaction gif from [nekos.best](https://nekos.best), an SFW
  anime-reaction-gif API — no API key needed)
- **Info** — `commands`/`cmds`

On top of these ~30 built-in commands, server admins can add an unlimited number of
their own custom text commands with `/customcommand add` — there's no hardcoded
limit, so a server can genuinely grow this into hundreds of commands without
touching the bot's source code.

### Ticket system

`/ticketsetup` supports multiple ticket types (each with its own category, support
role, emoji, and welcome message), a button or dropdown panel depending on how many
types exist, a claim button, per-user open-ticket limits, transcript logging to a
channel, and optionally requiring a reason before a ticket can be closed. `/tickets`
manages the ticket you're currently sitting in (close, add a user, remove a user).

## Not included

The automated purchasing/licensing system described in the docs (checkout, instant
delivery, linking bot access to a purchase) is a separate backend/e-commerce concern
and is not part of this bot codebase.
