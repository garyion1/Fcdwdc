const { PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { logAction } = require('../utils/logger');
const { isBotUsable } = require('../utils/premium');
const { hasCommandPermissions } = require('../utils/fakePermissions');
const { handleMessageXp } = require('../utils/leveling');
const { handleBumpSuccess, DISBOARD_BOT_ID } = require('../utils/bumpReminder');

async function handleAutoresponders(message, config) {
  const content = message.content.toLowerCase();

  for (const [trigger, entry] of Object.entries(config.autoresponders)) {
    const matches = entry.exclusive ? content.trim() === trigger : content.includes(trigger);
    if (!matches) continue;
    if (entry.roleIds?.length > 0 && !entry.roleIds.some((id) => message.member?.roles.cache.has(id))) continue;

    const response = entry.response
      .replace(/{user}/g, `<@${message.author.id}>`)
      .replace(/{user\.name}/g, message.author.username)
      .replace(/{server}/g, message.guild.name);
    await message.channel.send(response).catch(() => {});
    return;
  }
}

// Prefix commands that stay usable even without an active license.
const PREMIUM_EXEMPT_PREFIX_COMMANDS = new Set(['commands', 'cmds', 'prefixhelp']);
const NO_LICENSE_MESSAGE =
  'This server does not have an active Boat Bot license. Run `/redeem <key>` to activate premium, or `/premium` to check status.';

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i;
const LINK_REGEX = /https?:\/\/\S+/i;
const SPAM_WINDOW_MS = 6000;
const SPAM_MESSAGE_LIMIT = 6;

const recentMessages = new Map();

// The spam window is seconds; the map was keeping a key per author seen.
setInterval(() => {
  const cutoff = Date.now() - SPAM_WINDOW_MS;
  for (const [userId, timestamps] of recentMessages) {
    if (!timestamps.length || timestamps[timestamps.length - 1] < cutoff) recentMessages.delete(userId);
  }
}, 5 * 60 * 1000).unref?.();

function isSpam(userId) {
  const now = Date.now();
  const timestamps = (recentMessages.get(userId) ?? []).filter((t) => now - t < SPAM_WINDOW_MS);
  timestamps.push(now);
  recentMessages.set(userId, timestamps);
  return timestamps.length > SPAM_MESSAGE_LIMIT;
}

function matchPrefix(content, prefixes) {
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  return sorted.find((p) => content.startsWith(p));
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild) return;

    if (message.author.bot) {
      if (message.author.id === DISBOARD_BOT_ID && isBotUsable(message.guild.id)) {
        await handleBumpSuccess(message).catch(() => {});
      }
      return;
    }

    const config = getConfig(message.guild.id);
    const usable = isBotUsable(message.guild.id);

    if (usable) {
      if (config.afk[message.author.id]) {
        delete config.afk[message.author.id];
        saveConfig(message.guild.id);
        message.reply('Welcome back — I removed your AFK status.').catch(() => {});
      }

      for (const mentioned of message.mentions.users.values()) {
        const afk = config.afk[mentioned.id];
        if (afk) {
          message.reply(`💤 ${mentioned.tag} is AFK: ${afk.reason}`).catch(() => {});
        }
      }
    }

    if (usable && config.automod?.enabled && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const reasons = [];
      if (config.automod.filterInvites && INVITE_REGEX.test(message.content)) reasons.push('Discord invite link');
      if (config.automod.filterLinks && LINK_REGEX.test(message.content)) reasons.push('link');
      if (config.automod.filterCaps && message.content.length > 10) {
        const letters = message.content.replace(/[^a-zA-Z]/g, '');
        const upper = message.content.replace(/[^A-Z]/g, '');
        if (letters.length > 10 && upper.length / letters.length > 0.7) reasons.push('excessive caps');
      }
      if (config.automod.filterSpam && isSpam(message.author.id)) reasons.push('spam');
      if (config.automod.bannedWords?.some((w) => message.content.toLowerCase().includes(w.toLowerCase()))) {
        reasons.push('banned word');
      }

      if (reasons.length > 0) {
        await message.delete().catch(() => {});
        await logAction(message.guild, `🛡️ Deleted a message from ${message.author.tag} in ${message.channel} (${reasons.join(', ')})`);
        return;
      }
    }

    const prefix = matchPrefix(message.content, config.prefixes);

    if (!prefix) {
      if (!usable) return;
      await handleAutoresponders(message, config).catch(() => {});
      await handleMessageXp(message).catch((error) => console.error('Leveling error:', error));
      return;
    }

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    let commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    // Server-defined aliases resolve to a real command before lookup.
    if (!client.prefixCommands.has(commandName) && config.aliases[commandName]) {
      commandName = config.aliases[commandName];
    }

    const command = client.prefixCommands.get(commandName);
    if (command) {
      if (!usable && !PREMIUM_EXEMPT_PREFIX_COMMANDS.has(commandName)) {
        return message.reply(NO_LICENSE_MESSAGE).catch(() => {});
      }
      if (command.permissions && !hasCommandPermissions(message.member, command.permissions)) {
        return message.reply("You don't have permission to use that command.").catch(() => {});
      }
      try {
        await command.execute(message, args, config, client);
      } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        await message.reply('Something went wrong while running that command.').catch(() => {});
      }
      return;
    }

    if (!usable) return;

    const response = config.customCommands[commandName];
    if (response) await message.channel.send(response).catch(() => {});
  },
};
