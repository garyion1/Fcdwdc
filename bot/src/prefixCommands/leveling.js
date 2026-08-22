const { PermissionFlagsBits } = require('discord.js');
const { saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');
const { levelFromTotalXp, setLevel, setXp, rankOf, allRankedUsers, leaderboard, applyLevelRoles } = require('../utils/leveling');

const CATEGORY = 'Leveling';

function progressBar(into, needed, size = 20) {
  const filled = needed === 0 ? 0 : Math.round((into / needed) * size);
  return `${'█'.repeat(Math.min(filled, size))}${'░'.repeat(Math.max(size - filled, 0))}`;
}

function resolveRole(message, arg) {
  if (!arg) return null;
  return (
    message.mentions.roles.first() ??
    message.guild.roles.cache.get(arg.replace(/[<@&>]/g, '')) ??
    message.guild.roles.cache.find((r) => r.name.toLowerCase() === arg.toLowerCase()) ??
    null
  );
}

function resolveChannel(message, arg) {
  if (!arg) return null;
  return message.mentions.channels.first() ?? message.guild.channels.cache.get(arg.replace(/[<#>]/g, '')) ?? null;
}

module.exports = [
  {
    name: 'rank',
    aliases: ['level'],
    category: CATEGORY,
    description: 'Show your level and XP. Usage: rank [@user]',
    async execute(message, args, config) {
      if (!config.leveling.enabled) return message.reply('Leveling is disabled here — an admin can turn it on with `levels on`.');
      const user = (await resolveUser(message, args[0])) ?? message.author;
      const { xp, position } = rankOf(message.guild.id, user.id);
      const { level, into, needed } = levelFromTotalXp(xp);

      return message.channel.send({
        embeds: [
          baseEmbed()
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setDescription(`${progressBar(into, needed)}\n**${into} / ${needed} XP** to level ${level + 1}`)
            .addFields(
              { name: 'Level', value: `${level}`, inline: true },
              { name: 'Total XP', value: `${xp}`, inline: true },
              { name: 'Rank', value: position > 0 ? `#${position}` : 'Unranked', inline: true },
            ),
        ],
      });
    },
  },
  {
    name: 'setlevel',
    category: CATEGORY,
    description: "Set a member's level. Usage: setlevel @user <level>",
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const level = parseInt(args[1], 10);
      if (!user || !Number.isFinite(level) || level < 0) return message.reply('Usage: `setlevel @user <level>`');
      setLevel(message.guild.id, user.id, level);
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member) await applyLevelRoles(member, level);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** is now level **${level}**.`)] });
    },
  },
  {
    name: 'setxp',
    category: CATEGORY,
    description: "Set a member's total XP. Usage: setxp @user <xp>",
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      const xp = parseInt(args[1], 10);
      if (!user || !Number.isFinite(xp) || xp < 0) return message.reply('Usage: `setxp @user <xp>`');
      const level = setXp(message.guild.id, user.id, xp);
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member) await applyLevelRoles(member, level);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** now has **${xp}** XP (level ${level}).`)] });
    },
  },
  {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    category: CATEGORY,
    description: 'Show the XP leaderboard.',
    async execute(message, args, config) {
      if (!config.leveling.enabled) return message.reply('Leveling is disabled here — an admin can turn it on with `levels on`.');
      const top = leaderboard(message.guild.id, 10);
      if (top.length === 0) return message.channel.send('Nobody has earned any XP yet.');
      const lines = top.map((entry, index) => `**${index + 1}.** <@${entry.userId}> — level ${entry.level} (${entry.xp} XP)`);
      return message.channel.send({ embeds: [baseEmbed().setTitle(`🏆 ${message.guild.name} leaderboard`).setDescription(lines.join('\n'))] });
    },
  },
  {
    name: 'levels',
    aliases: ['leveling'],
    category: CATEGORY,
    description: 'Configure leveling. Usage: levels on|off|add|remove|list|roles|ignore|stackroles|message|messagemode|setrate|sync|leaderboard',
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const isManager = message.member?.permissions.has(PermissionFlagsBits.ManageGuild);

      if (action === 'leaderboard' || action === 'lb' || !action) {
        const top = leaderboard(message.guild.id, 10);
        if (top.length === 0) return message.channel.send('Nobody has earned any XP yet.');
        const lines = top.map((entry, index) => `**${index + 1}.** <@${entry.userId}> — level ${entry.level} (${entry.xp} XP)`);
        return message.channel.send({ embeds: [baseEmbed().setTitle(`${message.guild.name} leaderboard`).setDescription(lines.join('\n'))] });
      }

      if (!isManager) return message.reply("You don't have permission to configure leveling.");

      if (action === 'on' || action === 'off') {
        config.leveling.enabled = action === 'on';
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Leveling is now **${action}**.`)] });
      }

      if (action === 'add') {
        const level = parseInt(args[1], 10);
        const role = resolveRole(message, args.slice(2).join(' '));
        if (!Number.isFinite(level) || !role) return message.reply('Usage: `levels add <level> <role>`');
        config.leveling.roles[level] = role.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`${role} will be awarded at level **${level}**.`)] });
      }

      if (action === 'remove') {
        const level = parseInt(args[1], 10);
        if (!Number.isFinite(level) || !config.leveling.roles[level]) return message.reply('Usage: `levels remove <level>`');
        delete config.leveling.roles[level];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Level **${level}** no longer awards a role.`)] });
      }

      if (action === 'roles' || action === 'list') {
        const entries = Object.entries(config.leveling.roles).sort((a, b) => Number(a[0]) - Number(b[0]));
        if (entries.length === 0) return message.channel.send('No level rewards have been set up.');
        return message.channel.send({
          embeds: [
            baseEmbed()
              .setTitle('Level rewards')
              .setDescription(entries.map(([level, roleId]) => `Level **${level}** → <@&${roleId}>`).join('\n')),
          ],
        });
      }

      if (action === 'ignore') {
        const channel = resolveChannel(message, args[1]) ?? message.channel;
        const index = config.leveling.ignoredChannels.indexOf(channel.id);
        if (index === -1) config.leveling.ignoredChannels.push(channel.id);
        else config.leveling.ignoredChannels.splice(index, 1);
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`${channel} will ${index === -1 ? 'no longer' : 'now'} earn XP.`)],
        });
      }

      if (action === 'stackroles') {
        config.leveling.stackRoles = !config.leveling.stackRoles;
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              config.leveling.stackRoles ? 'Members now keep every level role they earn.' : 'Members now only keep their highest level role.',
            ),
          ],
        });
      }

      if (action === 'message') {
        const text = args.slice(1).join(' ');
        if (!text) return message.reply('Usage: `levels message <text>` — placeholders: `{user}` `{level}` `{server}`');
        config.leveling.message = text;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Level-up message updated.')] });
      }

      if (action === 'messagemode') {
        const mode = args[1]?.toLowerCase();
        if (!['channel', 'dm', 'none'].includes(mode)) return message.reply('Usage: `levels messagemode <channel|dm|none>`');
        config.leveling.messageMode = mode;
        if (mode === 'channel' && args[2]) {
          const channel = resolveChannel(message, args[2]);
          config.leveling.channel = channel?.id ?? null;
        }
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Level-up announcements set to \`${mode}\`.`)] });
      }

      if (action === 'setrate') {
        const rate = parseFloat(args[1]);
        if (!Number.isFinite(rate) || rate <= 0 || rate > 10) return message.reply('Usage: `levels setrate <0.1 - 10>`');
        config.leveling.rate = rate;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`XP rate set to **${rate}x**.`)] });
      }

      if (action === 'sync') {
        const notice = await message.channel.send('Syncing level roles for everyone with XP...');
        let synced = 0;
        for (const { userId, xp } of allRankedUsers(message.guild.id)) {
          const member = await message.guild.members.fetch(userId).catch(() => null);
          if (!member) continue;
          await applyLevelRoles(member, levelFromTotalXp(xp).level);
          synced += 1;
        }
        return notice.edit({ content: null, embeds: [baseEmbed(COLORS.success).setDescription(`Synced level roles for **${synced}** member(s).`)] });
      }

      return message.reply('Usage: `levels on|off|add|remove|roles|ignore|stackroles|message|messagemode|setrate|sync|leaderboard`');
    },
  },
];
