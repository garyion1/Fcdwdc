const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logAction } = require('../utils/logger');
const { lockChannel, unlockChannel } = require('../utils/channelLock');
const { schedulePurge, stopPurge } = require('../utils/autopurge');
const { isRaidActive, endRaidMode } = require('../utils/antiraid');
const { jailMember, unjailMember } = require('../utils/jail');
const { containsBadWord } = require('../utils/profanity');
const { resolveUser, parseDuration } = require('../utils/args');
const { slugify } = require('../utils/tickets');
const { scheduleTempBan } = require('../utils/tempban');
const { invokeText } = require('../utils/invokeMessages');
const { notifyPunishedMember, undeliveredNote } = require('../utils/modDm');

const CATEGORY = 'Moderation';

function resolveRole(message, arg) {
  if (!arg) return null;
  return (
    message.mentions.roles.first() ??
    message.guild.roles.cache.get(arg.replace(/[<@&>]/g, '')) ??
    message.guild.roles.cache.find((r) => r.name.toLowerCase() === arg.toLowerCase()) ??
    null
  );
}

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
    name: 'lockdown',
    category: CATEGORY,
    description: 'Lock every text channel in the server. Usage: lockdown [reason]',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
      const reason = args.join(' ') || 'Server lockdown';
      const channels = message.guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread());
      let locked = 0;
      for (const channel of channels.values()) {
        const result = await lockChannel(channel, message.author, reason).catch(() => null);
        if (result && !result.alreadyLocked) locked += 1;
      }
      await logAction(message.guild, `🔒 Server-wide lockdown triggered by ${message.author.tag} (${locked} channel(s) locked)\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔒 Lockdown complete — ${locked} channel(s) locked.\nReason: ${reason}`)] });
    },
  },
  {
    name: 'unlockall',
    category: CATEGORY,
    description: 'Unlock every locked channel in the server. Usage: unlockall',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message) {
      const config = getConfig(message.guild.id);
      const lockedIds = Object.keys(config.locks);
      let unlocked = 0;
      for (const channelId of lockedIds) {
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
          delete config.locks[channelId];
          continue;
        }
        const result = await unlockChannel(channel, message.author).catch(() => null);
        if (result && !result.notLocked) unlocked += 1;
      }
      saveConfig(message.guild.id);
      await logAction(message.guild, `🔓 Server-wide unlock triggered by ${message.author.tag} (${unlocked} channel(s) unlocked)`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔓 Unlocked ${unlocked} channel(s).`)] });
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

      const config = getConfig(message.guild.id);
      const ctx = { user, moderator: message.author, reason, guild: message.guild };
      const channelText = invokeText(config, 'kick', 'message', ctx);

      // Before the kick — afterwards there's no shared server left to DM through.
      const delivered = await notifyPunishedMember('kick', { user, guild: message.guild, config, reason, moderator: message.author });

      await member.kick(reason);
      await logAction(message.guild, `👢 **${user.tag}** was kicked by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            channelText ?? `**${user.tag}** has been kicked.\nReason: ${reason}${undeliveredNote(delivered)}`,
          ),
        ],
      });
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

      const config = getConfig(message.guild.id);
      const ctx = { user, moderator: message.author, reason, guild: message.guild };
      const channelText = invokeText(config, 'ban', 'message', ctx);

      // Before the ban — afterwards there's no shared server left to DM through.
      const delivered = await notifyPunishedMember('ban', { user, guild: message.guild, config, reason, moderator: message.author });

      await message.guild.members.ban(user.id, { reason });
      await logAction(message.guild, `🔨 **${user.tag}** was banned by ${message.author.tag}\nReason: ${reason}`);

      // Mention renders the name without pinging (allowedMentions is empty).
      return message.channel.send({
        content: channelText ?? `👍 <@${user.id}> was banned${undeliveredNote(delivered)}`,
        allowedMentions: { parse: [] },
      });
    },
  },
  {
    name: 'hb',
    aliases: ['hardban'],
    category: CATEGORY,
    description: "Hard ban a member — bans and deletes their last 7 days of messages. Usage: hb @user [reason]",
    permissions: [PermissionFlagsBits.BanMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `hb @user [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return message.reply('I cannot ban that member (check role hierarchy).');
      await user
        .send({ embeds: [baseEmbed(COLORS.danger).setDescription(`🔨 You have been banned from **${message.guild.name}**.\nReason: ${reason}`)] })
        .catch(() => {});
      await message.guild.members.ban(user.id, { reason, deleteMessageSeconds: 604800 });
      await logAction(message.guild, `🔨 **${user.tag}** was hard-banned (messages purged) by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been hard-banned (last 7 days of messages deleted).\nReason: ${reason}`)],
      });
    },
  },
  {
    name: 'tempban',
    category: CATEGORY,
    description: 'Temporarily ban a member. Usage: tempban @user <duration> [reason] (e.g. tempban @user 7d spamming)',
    permissions: [PermissionFlagsBits.BanMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const durationMs = parseDuration(args[1]);
      if (!user || !durationMs) return message.reply('Usage: `tempban @user <duration> [reason]` (e.g. `tempban @user 7d spamming`)');
      const reason = args.slice(2).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return message.reply('I cannot ban that member (check role hierarchy).');
      const expiresAt = Date.now() + durationMs;
      await user
        .send({
          embeds: [
            baseEmbed(COLORS.danger).setDescription(
              `🔨 You have been temporarily banned from **${message.guild.name}** until <t:${Math.floor(expiresAt / 1000)}:F>.\nReason: ${reason}`,
            ),
          ],
        })
        .catch(() => {});
      await message.guild.members.ban(user.id, { reason });
      const config = getConfig(message.guild.id);
      config.tempBans[user.id] = { expiresAt, moderator: message.author.id, reason };
      saveConfig(message.guild.id);
      scheduleTempBan(message.client, message.guild.id, user.id, durationMs);
      await logAction(message.guild, `🔨 **${user.tag}** was temp-banned by ${message.author.tag} until <t:${Math.floor(expiresAt / 1000)}:F>\nReason: ${reason}`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been temp-banned until <t:${Math.floor(expiresAt / 1000)}:F>.\nReason: ${reason}`)],
      });
    },
  },
  {
    name: 'softban',
    category: CATEGORY,
    description: "Softban a member — removes them and purges their recent messages, but doesn't leave a lasting ban. Usage: softban @user [reason]",
    permissions: [PermissionFlagsBits.BanMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `softban @user [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return message.reply('I cannot do that to that member (check role hierarchy).');
      await user
        .send({ embeds: [baseEmbed(COLORS.danger).setDescription(`👢 You have been removed from **${message.guild.name}**.\nReason: ${reason}`)] })
        .catch(() => {});
      await message.guild.members.ban(user.id, { reason: `Softban: ${reason}`, deleteMessageSeconds: 604800 });
      await message.guild.members.unban(user.id, 'Softban cleanup').catch(() => {});
      await logAction(message.guild, `👢 **${user.tag}** was softbanned by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been softbanned (removed, messages purged, free to rejoin).\nReason: ${reason}`)],
      });
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

      const config = getConfig(message.guild.id);
      const ctx = { user, moderator: message.author, reason, guild: message.guild, duration: `${minutes} minute(s)` };
      const channelText = invokeText(config, 'timeout', 'message', ctx);
      const delivered = await notifyPunishedMember('timeout', {
        user,
        guild: message.guild,
        config,
        reason,
        moderator: message.author,
        duration: `${minutes} minute(s)`,
      });

      await member.timeout(Math.min(minutes, 40320) * 60 * 1000, reason);
      await logAction(message.guild, `⏱️ **${user.tag}** was timed out for ${minutes}m by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            channelText ?? `**${user.tag}** has been timed out for ${minutes} minute(s).${undeliveredNote(delivered)}`,
          ),
        ],
      });
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

      const ctx = { user, moderator: message.author, reason, guild: message.guild };
      const channelText = invokeText(config, 'warn', 'message', ctx);
      const delivered = await notifyPunishedMember('warn', { user, guild: message.guild, config, reason, moderator: message.author });

      await logAction(message.guild, `⚠️ **${user.tag}** was warned by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.warning).setDescription(
            channelText ??
              `**${user.tag}** has been warned.\nReason: ${reason}\nTotal warnings: ${config.warnings[user.id].length}${undeliveredNote(delivered)}`,
          ),
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
    name: 'autopurge',
    category: CATEGORY,
    description: 'Automatically purge this channel on a repeating interval. Usage: autopurge <minutes 5-10080|off>',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args, config, client) {
      const arg = args[0]?.toLowerCase();
      if (!arg) return message.reply('Usage: `autopurge <minutes 5-10080>` or `autopurge off`.');

      if (['off', 'stop', 'disable'].includes(arg)) {
        if (!config.autopurge[message.channel.id]) return message.reply('Autopurge is not enabled in this channel.');
        stopPurge(message.channel.id);
        delete config.autopurge[message.channel.id];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('🧹 Autopurge disabled for this channel.')] });
      }

      const minutes = parseInt(arg, 10);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 10080) {
        return message.reply('Usage: `autopurge <minutes 5-10080>` or `autopurge off`.');
      }

      config.autopurge[message.channel.id] = { intervalMinutes: minutes, enabledBy: message.author.id, enabledAt: Date.now() };
      saveConfig(message.guild.id);
      schedulePurge(client, message.guild.id, message.channel.id, minutes);

      await logAction(message.guild, `🧹 Autopurge enabled in ${message.channel} every ${minutes}m by ${message.author.tag}`);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.warning).setDescription(
            `🧹 This channel will be automatically purged every ${minutes} minute(s).\n(Only messages under 14 days old can be removed — a Discord API limit.)`,
          ),
        ],
      });
    },
  },
  {
    name: 'purgeuser',
    category: CATEGORY,
    description: "Delete a specific member's recent messages. Usage: purgeuser @user <amount 1-100>",
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const amount = parseInt(args[1], 10);
      if (!user || !Number.isFinite(amount) || amount < 1 || amount > 100) return message.reply('Usage: `purgeuser @user <amount 1-100>`');
      const recent = await message.channel.messages.fetch({ limit: 100 });
      const targeted = recent.filter((m) => m.author.id === user.id).first(amount);
      if (targeted.length === 0) return message.reply(`No recent messages found from ${user.tag}.`);
      const deleted = await message.channel.bulkDelete(targeted, true).catch(() => null);
      if (!deleted) return message.reply('Failed to delete messages (they may be older than 14 days).');
      await logAction(message.guild, `🧹 ${message.author.tag} purged ${deleted.size} message(s) from ${user.tag} in ${message.channel}`);
      const notice = await message.channel.send(`Deleted ${deleted.size} message(s) from ${user.tag}.`);
      setTimeout(() => notice.delete().catch(() => {}), 4000);
    },
  },
  {
    name: 'purgebots',
    category: CATEGORY,
    description: 'Delete recent messages sent by bots. Usage: purgebots <amount 1-100>',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
      const amount = parseInt(args[0], 10);
      if (!Number.isFinite(amount) || amount < 1 || amount > 100) return message.reply('Usage: `purgebots <amount 1-100>`');
      const recent = await message.channel.messages.fetch({ limit: 100 });
      const targeted = recent.filter((m) => m.author.bot).first(amount);
      if (targeted.length === 0) return message.reply('No recent bot messages found.');
      const deleted = await message.channel.bulkDelete(targeted, true).catch(() => null);
      if (!deleted) return message.reply('Failed to delete messages (they may be older than 14 days).');
      await logAction(message.guild, `🧹 ${message.author.tag} purged ${deleted.size} bot message(s) in ${message.channel}`);
      const notice = await message.channel.send(`Deleted ${deleted.size} bot message(s).`);
      setTimeout(() => notice.delete().catch(() => {}), 4000);
    },
  },
  {
    name: 'warnclear',
    category: CATEGORY,
    description: "Clear all of a member's warnings. Usage: warnclear @user",
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `warnclear @user`');
      const config = getConfig(message.guild.id);
      const count = config.warnings[user.id]?.length ?? 0;
      delete config.warnings[user.id];
      saveConfig(message.guild.id);
      await logAction(message.guild, `♻️ ${message.author.tag} cleared ${count} warning(s) for ${user.tag}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Cleared ${count} warning(s) for **${user.tag}**.`)] });
    },
  },
  {
    name: 'warnremove',
    category: CATEGORY,
    description: 'Remove a single warning from a member by number. Usage: warnremove @user <#>',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const index = parseInt(args[1], 10);
      if (!user || !Number.isFinite(index) || index < 1) return message.reply('Usage: `warnremove @user <#>` (see the number from `warnings @user`)');
      const config = getConfig(message.guild.id);
      const warnings = config.warnings[user.id] ?? [];
      if (index > warnings.length) return message.reply(`**${user.tag}** only has ${warnings.length} warning(s).`);
      const [removed] = warnings.splice(index - 1, 1);
      saveConfig(message.guild.id);
      await logAction(message.guild, `♻️ ${message.author.tag} removed warning #${index} from ${user.tag}\nReason: ${removed.reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Removed warning #${index} from **${user.tag}**.\nReason was: ${removed.reason}`)] });
    },
  },
  {
    name: 'antiraid',
    category: CATEGORY,
    description: 'Toggle anti-raid protection or end active raid mode. Usage: antiraid <on|off|end|status>',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();

      if (action === 'on') {
        config.antiraid.enabled = true;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('🛡️ Anti-raid protection enabled.')] });
      }

      if (action === 'off') {
        config.antiraid.enabled = false;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('🛡️ Anti-raid protection disabled.')] });
      }

      if (action === 'end') {
        const result = await endRaidMode(message.guild, message.author);
        if (result.notActive) return message.reply('Raid mode is not currently active.');
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('✅ Raid mode ended and locked channels restored.')] });
      }

      if (action === 'status') {
        const active = isRaidActive(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed()
              .setTitle('Anti-raid Status')
              .addFields(
                { name: 'Enabled', value: config.antiraid.enabled ? 'Yes' : 'No', inline: true },
                { name: 'Raid mode active', value: active ? 'Yes 🚨' : 'No', inline: true },
                { name: 'Join threshold', value: `${config.antiraid.joinThreshold} joins / ${config.antiraid.windowSeconds}s`, inline: true },
                {
                  name: 'Min account age',
                  value: config.antiraid.minAccountAgeMinutes > 0 ? `${config.antiraid.minAccountAgeMinutes}m` : 'Disabled',
                  inline: true,
                },
              ),
          ],
        });
      }

      return message.reply('Usage: `antiraid <on|off|end|status>` — use `/antiraid settings` for detailed tuning.');
    },
  },
  {
    name: 'jail',
    category: CATEGORY,
    description: 'Jail a member so they can only see the jail channel. Usage: jail @user [reason]',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `jail @user [reason]`');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');
      if (!member.manageable) return message.reply('I cannot jail that member (check role hierarchy).');

      const notice = await message.channel.send('🔒 Setting up jail...');
      const result = await jailMember(message.guild, member, message.author, reason);
      if (result.alreadyJailed) {
        return notice.edit({ content: null, embeds: [baseEmbed(COLORS.warning).setDescription(`**${user.tag}** is already jailed.`)] });
      }
      if (result.hierarchyError) {
        return notice.edit({ content: null, embeds: [baseEmbed(COLORS.danger).setDescription('I cannot jail that member (check role hierarchy).')] });
      }

      return notice.edit({
        content: null,
        embeds: [
          baseEmbed(COLORS.danger).setDescription(
            `🔒 **${user.tag}** has been jailed.\nReason: ${reason}\nThey can now only see ${result.channel}.`,
          ),
        ],
      });
    },
  },
  {
    name: 'unjail',
    category: CATEGORY,
    description: 'Release a jailed member and restore their previous roles. Usage: unjail @user',
    permissions: [PermissionFlagsBits.ModerateMembers],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `unjail @user`');
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');

      const result = await unjailMember(message.guild, member, message.author);
      if (result.notJailed) return message.reply(`**${user.tag}** is not jailed.`);

      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔓 **${user.tag}** has been released from jail.`)] });
    },
  },
  {
    name: 'say',
    category: CATEGORY,
    description: 'Make the bot say something in this channel. Usage: say <message>',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
      const text = args.join(' ');
      if (!text) return message.reply('Usage: `say <message>`');
      if (containsBadWord(text, message.guild.id)) {
        return message.reply('That message contains a blocked word and was not sent.');
      }
      await message.delete().catch(() => {});
      return message.channel.send(text);
    },
  },
  {
    name: 'embed',
    category: CATEGORY,
    description: 'Make the bot send an embed with your text. Usage: embed <message>',
    permissions: [PermissionFlagsBits.ManageMessages],
    async execute(message, args) {
      const text = args.join(' ');
      if (!text) return message.reply('Usage: `embed <message>`');
      if (containsBadWord(text, message.guild.id)) {
        return message.reply('That message contains a blocked word and was not sent.');
      }
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [baseEmbed().setDescription(text)] });
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
  {
    name: 'ticket',
    category: CATEGORY,
    description: 'Clear all 5 ticket option slots at once. Usage: ticket option',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args) {
      if (args[0]?.toLowerCase() !== 'option') {
        return message.reply(
          'Usage: `ticket option` — clears all 5 ticket option slots. Use `add ticket option <1-5> <name>` to set one, `remove ticket option <1-5>` to clear just one.',
        );
      }

      const config = getConfig(message.guild.id);
      const slots = Object.values(config.tickets.types).filter((t) => t.slot);
      if (slots.length === 0) return message.reply('No ticket options are set.');

      for (const entry of slots) delete config.tickets.types[entry.id];
      saveConfig(message.guild.id);

      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            `Cleared all ${slots.length} ticket option(s). Their category channels were left in place — delete them manually if you don't need them. Use \`add ticket option <1-5> <name>\` to set new ones.`,
          ),
        ],
      });
    },
  },
  {
    name: 'add',
    category: CATEGORY,
    description: 'Add a ticket type. Usage: add ticket type <name>  |  add ticket option <1-5> <name>',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args) {
      const kind = args[1]?.toLowerCase();
      if (args[0]?.toLowerCase() !== 'ticket' || (kind !== 'option' && kind !== 'type')) {
        return message.reply('Usage: `add ticket type <name>` or `add ticket option <1-5> <name>`');
      }

      const config = getConfig(message.guild.id);

      if (kind === 'type') {
        const name = args.slice(2).join(' ');
        if (!name) return message.reply('Usage: `add ticket type <name>`, e.g. `add ticket type Purchase`');

        if (Object.keys(config.tickets.types).length >= 25) {
          return message.reply('You can have at most 25 ticket types (a Discord select menu limit).');
        }

        let id = slugify(name);
        let suffix = 2;
        while (config.tickets.types[id]) {
          id = `${slugify(name)}-${suffix}`;
          suffix += 1;
        }

        const notice = await message.channel.send(`🎫 Setting up ticket type **${name}**...`);
        const category = await message.guild.channels.create({ name, type: ChannelType.GuildCategory });
        config.tickets.types[id] = {
          id,
          label: name,
          description: null,
          category: category.id,
          supportRoleId: null,
          emoji: null,
          welcomeMessage: null,
          slot: null,
        };
        saveConfig(message.guild.id);

        return notice.edit({
          content: '',
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `Ticket type **${name}** added, with its own auto-created category. Send a panel with \`/ticketsetup panel\`.`,
            ),
          ],
        });
      }

      const slot = parseInt(args[2], 10);
      const name = args.slice(3).join(' ');
      if (!Number.isInteger(slot) || slot < 1 || slot > 5 || !name) {
        return message.reply('Usage: `add ticket option <1-5> <name>`, e.g. `add ticket option 1 General Support`');
      }

      const existing = Object.values(config.tickets.types).find((t) => t.slot === slot);

      if (existing) {
        existing.label = name;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Ticket option ${slot} renamed to **${name}**.`)] });
      }

      if (Object.keys(config.tickets.types).length >= 25) {
        return message.reply('You can have at most 25 ticket types (a Discord select menu limit).');
      }

      let id = slugify(name);
      let suffix = 2;
      while (config.tickets.types[id]) {
        id = `${slugify(name)}-${suffix}`;
        suffix += 1;
      }

      const notice = await message.channel.send(`🎫 Setting up ticket option ${slot}...`);
      const category = await message.guild.channels.create({ name, type: ChannelType.GuildCategory });
      config.tickets.types[id] = {
        id,
        label: name,
        description: null,
        category: category.id,
        supportRoleId: null,
        emoji: null,
        welcomeMessage: null,
        slot,
      };
      saveConfig(message.guild.id);

      return notice.edit({
        content: '',
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            `Ticket option ${slot} set to **${name}**, with its own auto-created category. Send a panel with \`/ticketsetup panel\`.`,
          ),
        ],
      });
    },
  },
  {
    name: 'remove',
    category: CATEGORY,
    description: 'Remove ticket type(s). Usage: remove ticket type <name|all>  |  remove ticket option <1-5|all>',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args) {
      const kind = args[1]?.toLowerCase();
      if (args[0]?.toLowerCase() !== 'ticket' || (kind !== 'option' && kind !== 'type' && kind !== 'types')) {
        return message.reply('Usage: `remove ticket type <name|all>` or `remove ticket option <1-5|all>`');
      }

      const config = getConfig(message.guild.id);

      if (kind === 'type' || kind === 'types') {
        const target = args.slice(2).join(' ');
        if (!target) return message.reply('Usage: `remove ticket type <name|all>`');

        if (target.toLowerCase() === 'all') {
          const all = Object.values(config.tickets.types);
          if (all.length === 0) return message.reply('No ticket types are configured.');

          for (const entry of all) delete config.tickets.types[entry.id];
          saveConfig(message.guild.id);

          return message.channel.send({
            embeds: [
              baseEmbed(COLORS.success).setDescription(
                `Cleared all ${all.length} ticket type(s). Their category channels were left in place — delete them manually if you don't need them.`,
              ),
            ],
          });
        }

        const entry = Object.values(config.tickets.types).find(
          (t) => t.id === target || t.label.toLowerCase() === target.toLowerCase(),
        );
        if (!entry) return message.reply('No ticket type found with that name.');

        delete config.tickets.types[entry.id];
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `Ticket type **${entry.label}** removed. Its category channel was left in place — delete it manually if you don't need it.`,
            ),
          ],
        });
      }

      if (args[2]?.toLowerCase() === 'all') {
        const slots = Object.values(config.tickets.types).filter((t) => t.slot);
        if (slots.length === 0) return message.reply('No ticket options are set.');

        for (const entry of slots) delete config.tickets.types[entry.id];
        saveConfig(message.guild.id);

        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `Cleared all ${slots.length} ticket option(s). Their category channels were left in place — delete them manually if you don't need them.`,
            ),
          ],
        });
      }

      const slot = parseInt(args[2], 10);
      if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
        return message.reply('Usage: `remove ticket option <1-5|all>`');
      }

      const entry = Object.values(config.tickets.types).find((t) => t.slot === slot);
      if (!entry) return message.reply(`No ticket option ${slot} exists.`);

      delete config.tickets.types[entry.id];
      saveConfig(message.guild.id);
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.success).setDescription(
            `Ticket option ${slot} (**${entry.label}**) removed. Its category channel was left in place — delete it manually if you don't need it.`,
          ),
        ],
      });
    },
  },
  {
    name: 'role',
    category: CATEGORY,
    description: 'Give or take a role from a member. Usage: role @user <role>',
    permissions: [PermissionFlagsBits.ManageRoles],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const role = resolveRole(message, args.slice(1).join(' '));
      if (!user || !role) return message.reply('Usage: `role @user <role>`');
      if (!role.editable) return message.reply('I cannot manage that role — move my role above it.');

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('That user is not in this server.');

      const has = member.roles.cache.has(role.id);
      await (has ? member.roles.remove(role) : member.roles.add(role)).catch(() => {});
      await logAction(message.guild, `${has ? '➖' : '➕'} ${role} ${has ? 'removed from' : 'given to'} **${user.tag}** by ${message.author.tag}`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`${has ? 'Removed' : 'Gave'} ${role} ${has ? 'from' : 'to'} **${user.tag}**.`)],
      });
    },
  },
  {
    name: 'masskick',
    category: CATEGORY,
    description: 'Kick every member with a role. Usage: masskick <role> [reason]',
    permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.Administrator],
    async execute(message, args) {
      const role = resolveRole(message, args[0]);
      if (!role) return message.reply('Usage: `masskick <role> [reason]`');
      const reason = args.slice(1).join(' ') || 'Mass kick';

      // role.members reads the member cache, which is capped for scale —
      // without this the command would only kick whoever happened to be
      // cached rather than everyone holding the role.
      await message.guild.members.fetch().catch(() => {});
      const targets = role.members.filter((m) => m.kickable);
      if (targets.size === 0) return message.reply('No kickable members have that role.');

      const notice = await message.channel.send(`Kicking ${targets.size} member(s) with ${role}...`);
      let kicked = 0;
      for (const member of targets.values()) {
        await member.kick(reason).catch(() => {});
        kicked += 1;
      }

      await logAction(message.guild, `👢 ${message.author.tag} mass-kicked ${kicked} member(s) with ${role}\nReason: ${reason}`);
      return notice.edit({ content: null, embeds: [baseEmbed(COLORS.success).setDescription(`Kicked **${kicked}** member(s) with ${role}.`)] });
    },
  },
  {
    name: 'massban',
    category: CATEGORY,
    description: 'Ban a list of members by ID. Usage: massban <id1> <id2> ... [-- reason]',
    permissions: [PermissionFlagsBits.BanMembers, PermissionFlagsBits.Administrator],
    async execute(message, args) {
      const separator = args.indexOf('--');
      const idArgs = separator === -1 ? args : args.slice(0, separator);
      const reason = separator === -1 ? 'Mass ban' : args.slice(separator + 1).join(' ') || 'Mass ban';
      const ids = [...new Set(idArgs.map((a) => a.replace(/[<@!>]/g, '')).filter((id) => /^\d{15,25}$/.test(id)))];

      if (ids.length === 0) return message.reply('Usage: `massban <id1> <id2> ... [-- reason]`');
      if (ids.length > 100) return message.reply('That is too many at once — split it into batches of 100 or fewer.');

      const notice = await message.channel.send(`Banning ${ids.length} user(s)...`);
      let banned = 0;
      for (const id of ids) {
        const ok = await message.guild.members.ban(id, { reason }).then(() => true).catch(() => false);
        if (ok) banned += 1;
      }

      await logAction(message.guild, `🔨 ${message.author.tag} mass-banned ${banned}/${ids.length} user(s)\nReason: ${reason}`);
      return notice.edit({
        content: null,
        embeds: [baseEmbed(COLORS.success).setDescription(`Banned **${banned}/${ids.length}** user(s).${banned < ids.length ? '\nSome IDs failed — already banned, invalid, or not found.' : ''}`)],
      });
    },
  },
  {
    name: 'unbanall',
    category: CATEGORY,
    description: 'Unban every currently banned user. Usage: unbanall confirm',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
      if (args[0]?.toLowerCase() !== 'confirm') {
        const bans = await message.guild.bans.fetch().catch(() => null);
        return message.reply(`This will unban **${bans?.size ?? 'all'}** user(s). Run \`unbanall confirm\` to go through with it.`);
      }

      const bans = await message.guild.bans.fetch().catch(() => null);
      if (!bans || bans.size === 0) return message.reply('There are no banned users.');

      const notice = await message.channel.send(`Unbanning ${bans.size} user(s)...`);
      let unbanned = 0;
      for (const ban of bans.values()) {
        const ok = await message.guild.members.unban(ban.user.id, 'Mass unban').then(() => true).catch(() => false);
        if (ok) unbanned += 1;
      }

      await logAction(message.guild, `♻️ ${message.author.tag} mass-unbanned ${unbanned} user(s)`);
      return notice.edit({ content: null, embeds: [baseEmbed(COLORS.success).setDescription(`Unbanned **${unbanned}** user(s).`)] });
    },
  },
];
