# Boat Bot — Source

This is the bot implementation described in [`docs/boat-bot.md`](../docs/boat-bot.md).

Built with [discord.js](https://discord.js.org) v14. Persistence is a single SQLite file
(`data/bot.sqlite3`, via `better-sqlite3`) — no external database server to run or connect to.

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
    config/
      db.js                  SQLite connection, schema, one-time legacy JSON migration
      database.js            Per-guild config store (guild_config table, JSON blob per row)
    utils/
      embeds.js              Shared embed styling
      logger.js              Mod-log channel helper
      args.js                Resolve a @mention or ID to a user
      channelLock.js         Lock/unlock a channel, including active threads
      tickets.js              Ticket open/claim/close, transcripts, panel builders
      licenses.js             Admin server ID + license keys (meta / licenses tables)
      premium.js              Per-guild premium status check + bot-owner check
  data/bot.sqlite3         Auto-created SQLite database (git-ignored, holds everything)
```

### Persistence

Everything lives in one SQLite file, `data/bot.sqlite3`, created automatically on first
run:

- `guild_config` — one row per server, config stored as a JSON blob (same shape as
  before, just moved off disk-per-file and into indexed rows)
- `licenses` — one row per license key, real columns (`tier`, `redeemed`, `guild_id`,
  `expires_at`, ...) instead of one big JSON object loaded into memory on every lookup
- `meta` — small key/value table, currently just the admin/control server ID

If you're upgrading from an older version of this bot that used per-guild JSON files
(`data/guilds/<id>.json`) and a `data/global.json`, nothing to do — on first startup
those are automatically imported into SQLite and renamed to `.migrated` (not deleted,
so your old data is still there if anything looks wrong). This only runs once; after
that the JSON files are ignored.

## Commands

Core slash commands (see [`docs/boat-bot.md`](../docs/boat-bot.md#commands)):
`/help`, `/setup`, `/config`, `/stats`, `/tickets`, `/moderation`, `/settings`, `/support`

Additional slash commands:
`/ticketsetup` (configure ticket types/panels/behavior), `/lock` / `/unlock` (channel
lock that also blocks and locks threads), `/jail` / `/unjail` (isolate a member to a
single jail channel — see below), `/autopurge` (schedule a channel to
auto-clean on a repeating interval), `/antiraid` (burst-join detection with optional
auto-lockdown, plus an always-on minimum account age gate), `/license` / `/redeem` /
`/premium` / `/adminserver` (built-in licensing — see below), `/customcommand`,
`/embed`, `/say`, `/reactionrole`, `/giveaway`

### Text (prefix) commands

The bot also responds to plain text commands using any of a server's configured
prefixes (default: `!` `.` `?` `,` `$` — manage them with `/settings prefix`). Run
`!commands` in a server for the full grouped list. Built-in categories:

- **Moderation** — `lock`, `unlock`, `kick`, `ban`, `unban`, `timeout`/`mute`,
  `untimeout`/`unmute`, `warn`, `warnings`, `warnclear`, `clear`/`purge`, `purgeuser`,
  `purgebots`, `autopurge`, `antiraid`, `jail`, `unjail`, `say`, `embed`, `slowmode`, `nick`
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

### Jail

`/jail @user [reason]` (or `,jail @user [reason]`) isolates a member so the only
channel they can see is a dedicated jail channel — everything else in the server
disappears for them. On first use per server it auto-creates a `Jailed` role and a
`#jail` text channel (remembered afterward, so this only happens once), denies that
role `View Channel` on every existing channel, and swaps the member's roles for just
`Jailed` (their previous roles are recorded so `/unjail` / `,unjail` can restore them
exactly). Any channel created *after* that point is automatically locked out for the
`Jailed` role too, so the jail doesn't leak as the server grows. Requires **Moderate
Members**; fails cleanly with a role-hierarchy message if the bot can't manage the
target.

### /say, ,say, /embed, ,embed and the profanity filter

`say`/`embed` (both slash and prefix, **Manage Messages** required) make the bot
post text — plain for `say`, wrapped in an embed for `embed`. Since this lets a mod
put arbitrary words in the bot's mouth, every one of these four is filtered through
`src/utils/profanity.js` before sending: if the text matches a blocked word, nothing
is posted and the invoker gets a rejection instead. The filter checks a small
built-in baseline of common profanity (deliberately not exhaustive — no slurs are
hardcoded into the source) plus each server's own extended list, managed with
`/settings bannedwords add|remove|list`. That same per-server list also feeds the
existing automod word filter, so adding a word once covers both.

### Licensing (self-managed, no payment backend)

The bot manages its own license keys — there's no Stripe/PayPal integration, so you
still collect payment however you like (a payment link, manual invoicing, etc.) and
then hand the buyer a key.

- **Admin/control server** — the *first server the bot ever joins* is automatically
  designated the admin server (`guildCreate` event, stored in the `meta` table, not
  per-guild config — this only happens once). If the wrong server ends up as admin
  (e.g. a test server), the actual bot owner (checked against the Discord application's
  owner/team, not just a server admin) can move it with `/adminserver set` in the
  correct server; `/adminserver status` shows the current one from anywhere.
- **Issuing a key** — in the admin server, run `/license generate tier:<monthly|lifetime>`.
  This only works in the admin server, gated to members with Administrator there —
  that's intentionally your staff-only control panel. Give the generated key to the
  customer after they pay.
- **Activating it** — the customer runs `/redeem <key>` in their own server. This
  works from any server and sets that server's `premium.active`, `premium.tier`, and
  `premium.expiresAt` (monthly keys expire N days after redemption; lifetime keys
  never do — expiry is checked lazily on each `isPremiumActive()` call, no cron
  needed).
- **Checking status** — `/premium` anywhere, or `/license info <key>` /
  `/license list` / `/license revoke <key>` in the admin server.
- **Gating a feature** — nothing is premium-locked yet; call
  `isPremiumActive(guildId)` from `src/utils/premium.js` inside any command to decide
  what's free vs. paid. That's a product decision left to you.

## Not included

Real payment collection (Stripe/PayPal checkout, automatic instant delivery on
payment) is still a separate concern — this system covers key generation and
redemption, not taking the customer's money. Wiring a payment webhook to call
`createLicense()` automatically would close that gap if wanted later.
