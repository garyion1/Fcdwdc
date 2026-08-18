const { PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logAction } = require('../utils/logger');
const { lockChannel, unlockChannel } = require('../utils/channelLock');
const { resolveUser } = require('../utils/args');

const CATEGORY = 'Moderation';

module.exports = [
  {
    name: 'lock',
    category: CATEGORY,
    description: 'Lock this channel — blocks messages and thread creation. Usage: lock [reason]',
    permissions: [PermissionFlagsBits.ManageChannels],
    async execute(message, args) {
      const reason = args.join(' ') || 'No reason provided';
      const result = await lockChannel(message.channel, message.author, reason);
      if (result.alreadyLocked) return message.reply('This channel is already locked.');
      return message.channel.send({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔒 Channel locked.\nReason: ${reason}`)] });
    },
  },
  {
    name: 'unlock',
    category: CATEGORY,
    description: 'Unlock this channel.',
    permissions: [PermissionFlagsBits.ManageChannels],
    async execute(message) {
      const result = await unlockChannel(message.channel, message.author);
      if (result.notLocked) return message.reply('This channel is not locked.');
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('🔓 Channel unlocked.')] });
    },
  },
  {
    name: 'kick',
    category: CATEGORY,
    description: 'Kick a member. Usage: kick @user [reason]',
    permissions: [PermissionFlagsBits.KickMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `kick @user [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');
      if (!member.kickable) return message.reply('I cannot kick that member (check role hierarchy).');
      await member.kick(reason);
      await logAction(message.guild, `👢 **${user.tag}** was kicked by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been kicked.\nReason: ${reason}`)] });
    },
  },
  {
    name: 'ban',
    category: CATEGORY,
    description: 'Ban a member. Usage: ban @user [reason]',
    permissions: [PermissionFlagsBits.BanMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `ban @user [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return message.reply('I cannot ban that member (check role hierarchy).');
      await message.guild.members.ban(user.id, { reason });
      await logAction(message.guild, `🔨 **${user.tag}** was banned by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been banned.\nReason: ${reason}`)] });
    },
  },
  {
    name: 'unban',
    category: CATEGORY,
    description: 'Unban a user by ID. Usage: unban <userId> [reason]',
    permissions: [PermissionFlagsBits.BanMembers],
    async execute(message, args) {
      const id = args[0]?.replace(/[<@!>]/g, '');
      if (!id) return message.reply('Usage: `unban <userId> [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      await message.guild.members.unban(id, reason).catch(() => null);
      await logAction(message.guild, `♻️ <@${id}> was unbanned by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`<@${id}> has been unbanned.`)] });
    },
  },
  {
    name: 'timeout',
    aliases: ['mute'],
    category: CATEGORY,
    description: 'Timeout a member. Usage: timeout @user <minutes> [reason]',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const minutes = parseInt(args[1], 10);
      if (!user || !Number.isFinite(minutes) || minutes < 1) return message.reply('Usage: `timeout @user <minutes> [reason]`');
      const reason = args.slice(2).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');
      if (!member.moderatable) return message.reply('I cannot timeout that member (check role hierarchy).');
      await member.timeout(Math.min(minutes, 40320) * 60 * 1000, reason);
      await logAction(message.guild, `⏱️ **${user.tag}** was timed out for ${minutes}m by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been timed out for ${minutes} minute(s).`)] });
    },
  },
  {
    name: 'untimeout',
    aliases: ['unmute'],
    category: CATEGORY,
    description: 'Remove a timeout. Usage: untimeout @user',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `untimeout @user`');
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');
      await member.timeout(null).catch(() => {});
      await logAction(message.guild, `⏱️ **${user.tag}**'s timeout was removed by ${message.author.tag}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}**'s timeout has been removed.`)] });
    },
  },
  {
    name: 'warn',
    category: CATEGORY,
    description: 'Warn a member. Usage: warn @user <reason>',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const reason = args.slice(1).join(' ');
      if (!user || !reason) return message.reply('Usage: `warn @user <reason>`');
      const config = getConfig(message.guild.id);
      if (!config.warnings[user.id]) config.warnings[user.id] = [];
      config.warnings[user.id].push({ reason, moderator: message.author.id, timestamp: Date.now() });
      saveConfig(message.guild.id);
      await logAction(message.guild, `⚠️ **${user.tag}** was warned by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.warning).setDescription(`**${user.tag}** has been warned.\nReason: ${reason}\nTotal warnings: ${config.warnings[user.id].length}`),
        ],
      });
    },
  },
  {
    name: 'warnings',
    category: CATEGORY,
    description: "View a member's warnings. Usage: warnings @user",
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `warnings @user`');
      const config = getConfig(message.guild.id);
      const warnings = config.warnings[user.id] ?? [];
      if (warnings.length === 0) return message.channel.send(`**${user.tag}** has no warnings.`);
      const list = warnings.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R>`).join('\n');
      return message.channel.send({ embeds: [baseEmbed(COLORS.warning).setTitle(`Warnings for ${user.tag}`).setDescription(list)] });
    },
  },
  {
    name: 'clear',
    aliases: ['purge'],
    category: CATEGORY,
    description: 'Bulk delete messages. Usage: clear <amount 1-100>',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
      const amount = parseInt(args[0], 10);
      if (!Number.isFinite(amount) || amount < 1 || amount > 100) return message.reply('Usage: `clear <amount 1-100>`');
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
      if (!deleted) return message.reply('Failed to delete messages (they may be older than 14 days).');
      const count = Math.max(deleted.size - 1, 0);
      await logAction(message.guild, `🧹 ${message.author.tag} cleared ${count} messages in ${message.channel}`);
      const notice = await message.channel.send(`Deleted ${count} message(s).`);
      setTimeout(() => notice.delete().catch(() => {}), 4000);
    },
  },
  {
    name: 'slowmode',
    category: CATEGORY,
    description: 'Set slowmode for this channel. Usage: slowmode <seconds 0-21600>',
    permissions: [PermissionFlagsBits.ManageChannels],
    async execute(message, args) {
      const seconds = parseInt(args[0], 10);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 21600) return message.reply('Usage: `slowmode <seconds 0-21600>` (0 disables it)');
      await message.channel.setRateLimitPerUser(seconds);
      return message.channel.send(seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to ${seconds} second(s).`);
    },
  },
  {
    name: 'nick',
    category: CATEGORY,
    description: "Change a member's nickname. Usage: nick @user <new nickname|reset>",
    permissions: [PermissionFlagsBits.ManageNicknames],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `nick @user <new nickname|reset>`');
      const nickname = args.slice(1).join(' ');
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');
      try {
        await member.setNickname(!nickname || nickname.toLowerCase() === 'reset' ? null : nickname);
      } catch {
        return message.reply("I cannot change that member's nickname (check role hierarchy).");
      }
      return message.channel.send(`Nickname updated for ${user.tag}.`);
    },
  },
];
