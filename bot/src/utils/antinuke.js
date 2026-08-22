const { AuditLogEvent } = require('discord.js');
const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('./embeds');

// A single destructive action is usually legitimate. Antinuke fires once the
// same user takes THRESHOLD actions of one kind inside the window.
const ACTION_THRESHOLD = 3;
const ACTION_WINDOW_MS = 20000;

const recentActions = new Map();

// Entries were filtered by age on read but never deleted, so the map grew one
// key per (guild, user, action) seen for the life of the process.
setInterval(() => {
  const cutoff = Date.now() - ACTION_WINDOW_MS;
  for (const [key, timestamps] of recentActions) {
    if (timestamps.every((t) => t < cutoff)) recentActions.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function recordAction(guildId, userId, kind) {
  const key = `${guildId}:${userId}:${kind}`;
  const now = Date.now();
  const timestamps = (recentActions.get(key) ?? []).filter((t) => now - t < ACTION_WINDOW_MS);
  timestamps.push(now);
  recentActions.set(key, timestamps);
  return timestamps.length;
}

function clearActions(guildId, userId, kind) {
  recentActions.delete(`${guildId}:${userId}:${kind}`);
}

// The owner, the bot itself, and anyone whitelisted are never punished.
function isExempt(guild, config, userId) {
  if (!userId) return true;
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user.id) return true;
  if (config.antinuke.whitelist.includes(userId)) return true;
  if (config.antinuke.admins.includes(userId)) return true;
  return false;
}

// Whoever can configure antinuke: the guild owner and explicitly added admins.
function canConfigureAntinuke(member) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  const config = getConfig(member.guild.id);
  return config.antinuke.admins.includes(member.id);
}

async function findExecutor(guild, auditType) {
  const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 }).catch(() => null);
  const entry = logs?.entries.first();
  if (!entry) return null;
  // Audit entries older than a minute are almost certainly a different action.
  if (Date.now() - entry.createdTimestamp > 60000) return null;
  return entry.executor ?? null;
}

async function antinukeLog(guild, message, color = COLORS.danger) {
  const config = getConfig(guild.id);
  const channelId = config.antinuke.logChannel ?? config.modLogChannel;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [baseEmbed(color).setTitle('🛡️ Antinuke').setDescription(message)] }).catch(() => {});
}

async function punish(guild, user, reason) {
  const config = getConfig(guild.id);
  const member = await guild.members.fetch(user.id).catch(() => null);
  const action = config.antinuke.punishment;

  if (action === 'strip') {
    if (member) {
      const removable = member.roles.cache.filter((role) => role.id !== guild.id && role.editable);
      await member.roles.remove(removable, reason).catch(() => {});
    }
    return 'stripped of their roles';
  }

  if (action === 'kick') {
    if (member?.kickable) {
      await member.kick(reason).catch(() => {});
      return 'kicked';
    }
    return 'not kickable (check role hierarchy)';
  }

  if (member && !member.bannable) return 'not bannable (check role hierarchy)';
  await guild.members.ban(user.id, { reason }).catch(() => {});
  return 'banned';
}

// Called by every antinuke-watched event. `kind` matches the config toggle name.
async function handleAntinukeEvent(guild, kind, auditType, detail) {
  if (!guild) return;
  const config = getConfig(guild.id);
  if (!config.antinuke.enabled || !config.antinuke[kind]) return;

  const executor = await findExecutor(guild, auditType);
  if (!executor) return;
  if (isExempt(guild, config, executor.id)) return;

  const count = recordAction(guild.id, executor.id, kind);
  if (count < ACTION_THRESHOLD) return;
  clearActions(guild.id, executor.id, kind);

  const reason = `Antinuke: ${count} rapid ${kind} actions`;
  const outcome = await punish(guild, executor, reason);
  await antinukeLog(guild, `**${executor.tag}** triggered the \`${kind}\` protection${detail ? ` (${detail})` : ''} and was **${outcome}**.`);
}

// Bot adds are a single-action trip — one unauthorised bot is already a breach.
async function handleBotAdd(member) {
  const guild = member.guild;
  const config = getConfig(guild.id);
  if (!config.antinuke.enabled || !config.antinuke.botadd) return;
  if (config.antinuke.whitelist.includes(member.id)) return;

  const executor = await findExecutor(guild, AuditLogEvent.BotAdd);
  if (executor && isExempt(guild, config, executor.id)) return;

  if (member.bannable) await member.ban({ reason: 'Antinuke: unauthorised bot added' }).catch(() => {});

  if (executor) {
    const outcome = await punish(guild, executor, 'Antinuke: added an unauthorised bot');
    await antinukeLog(guild, `**${member.user.tag}** was added by **${executor.tag}** and removed. The adder was **${outcome}**.`);
  } else {
    await antinukeLog(guild, `**${member.user.tag}** was added without an audit trail and removed.`);
  }
}

async function handleVanityChange(oldGuild, newGuild) {
  const config = getConfig(newGuild.id);
  if (!config.antinuke.enabled || !config.antinuke.vanity) return;
  if (oldGuild.vanityURLCode === newGuild.vanityURLCode) return;

  const executor = await findExecutor(newGuild, AuditLogEvent.GuildUpdate);
  if (!executor || isExempt(newGuild, config, executor.id)) return;

  const outcome = await punish(newGuild, executor, 'Antinuke: changed the server vanity URL');
  await antinukeLog(
    newGuild,
    `**${executor.tag}** changed the vanity URL (\`${oldGuild.vanityURLCode ?? 'none'}\` → \`${newGuild.vanityURLCode ?? 'none'}\`) and was **${outcome}**.`,
  );
}

module.exports = {
  handleAntinukeEvent,
  handleBotAdd,
  handleVanityChange,
  canConfigureAntinuke,
  antinukeLog,
  ACTION_THRESHOLD,
};
