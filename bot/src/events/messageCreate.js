const { PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../config/database');
const { logAction } = require('../utils/logger');

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i;
const LINK_REGEX = /https?:\/\/\S+/i;
const SPAM_WINDOW_MS = 6000;
const SPAM_MESSAGE_LIMIT = 6;

const recentMessages = new Map();

function isSpam(userId) {
  const now = Date.now();
  const timestamps = (recentMessages.get(userId) ?? []).filter((t) => now - t < SPAM_WINDOW_MS);
  timestamps.push(now);
  recentMessages.set(userId, timestamps);
  return timestamps.length > SPAM_MESSAGE_LIMIT;
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const config = getConfig(message.guild.id);

    if (config.automod?.enabled && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
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

    if (!message.content.startsWith(config.prefix)) return;
    const commandName = message.content.slice(config.prefix.length).trim().toLowerCase().split(/\s+/)[0];
    if (!commandName) return;
    const response = config.customCommands[commandName];
    if (response) await message.channel.send(response).catch(() => {});
  },
};
