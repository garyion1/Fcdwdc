const { PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logAction } = require('../utils/logger');
const { lockChannel, unlockChannel } = require('../utils/channelLock');
const { schedulePurge, stopPurge } = require('../utils/autopurge');
const { isRaidActive, endRaidMode } = require('../utils/antiraid');
const { jailMember, unjailMember } = require('../utils/jail');
const { containsBadWord } = require('../utils/profanity');
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
      if (result.alreadyJailed) return notice.edit(`**${user.tag}** is already jailed.`);
      if (result.hierarchyError) return notice.edit('I cannot jail that member (check role hierarchy).');

      return notice.edit({
        content: '',
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
    name: 'dm',
    category: CATEGORY,
    description: 'DM every member of this server with a message. Usage: dm <message>',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args) {
      const text = args.join(' ');
      if (!text) return message.reply('Usage: `dm <message>`');

      const notice = await message.channel.send('📨 Sending a DM to every member... this can take a while on larger servers.');
      const members = await message.guild.members.fetch();

      let sent = 0;
      let failed = 0;
      for (const member of members.values()) {
        if (member.user.bot) continue;
        try {
          await member.send(text);
          sent += 1;
        } catch {
          failed += 1;
        }
        // Spaced out to stay well clear of Discord's DM rate limits.
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      return notice.edit(`📨 Done. Delivered to ${sent} member(s), failed for ${failed} (DMs off or blocked the bot).`);
    },
  },
];
