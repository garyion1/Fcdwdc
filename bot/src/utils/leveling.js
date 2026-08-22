const { getConfig, saveConfig } = require('../config/database');
const { db } = require('../config/db');

const XP_COOLDOWN_MS = 60000;
const XP_MIN = 15;
const XP_MAX = 25;

// XP lives in its own table, so awarding it is a single-row upsert rather
// than rewriting the guild's whole config blob on every message.
const getXpStmt = db.prepare('SELECT xp FROM guild_xp WHERE guild_id = ? AND user_id = ?');
const addXpStmt = db.prepare(`
  INSERT INTO guild_xp (guild_id, user_id, xp) VALUES (?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + excluded.xp
`);
const setXpStmt = db.prepare(`
  INSERT INTO guild_xp (guild_id, user_id, xp) VALUES (?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp
`);
const topXpStmt = db.prepare('SELECT user_id, xp FROM guild_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?');
const rankStmt = db.prepare('SELECT COUNT(*) AS ahead FROM guild_xp WHERE guild_id = ? AND xp > ?');
const allXpStmt = db.prepare('SELECT user_id, xp FROM guild_xp WHERE guild_id = ?');

// Per-user XP cooldown. Bounded so a long-running process across thousands
// of guilds doesn't accumulate an entry per member forever.
const lastXpAt = new Map();
const COOLDOWN_SWEEP_MS = 10 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - XP_COOLDOWN_MS;
  for (const [key, at] of lastXpAt) {
    if (at < cutoff) lastXpAt.delete(key);
  }
}, COOLDOWN_SWEEP_MS).unref?.();

function getXp(guildId, userId) {
  return getXpStmt.get(guildId, userId)?.xp ?? 0;
}

// Classic curve: level N needs 5N² + 50N + 100 XP to clear.
function xpForLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i += 1) total += xpForLevel(i);
  return total;
}

function levelFromTotalXp(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, into: remaining, needed: xpForLevel(level) };
}

async function applyLevelRoles(member, level) {
  const config = getConfig(member.guild.id);
  const entries = Object.entries(config.leveling.roles)
    .map(([lvl, roleId]) => ({ level: Number(lvl), roleId }))
    .filter((entry) => Number.isFinite(entry.level))
    .sort((a, b) => a.level - b.level);
  if (entries.length === 0) return;

  const earned = entries.filter((entry) => entry.level <= level);
  if (earned.length === 0) return;

  const toAdd = config.leveling.stackRoles ? earned : [earned[earned.length - 1]];
  const keep = new Set(toAdd.map((entry) => entry.roleId));

  for (const entry of entries) {
    const role = member.guild.roles.cache.get(entry.roleId);
    if (!role || !role.editable) continue;
    const shouldHave = keep.has(entry.roleId);
    if (shouldHave && !member.roles.cache.has(role.id)) await member.roles.add(role, 'Level reward').catch(() => {});
    if (!shouldHave && member.roles.cache.has(role.id)) await member.roles.remove(role, 'Level reward (unstacked)').catch(() => {});
  }
}

async function announceLevel(message, config, level) {
  if (config.leveling.messageMode === 'none') return;
  const text = config.leveling.message.replace(/{user}/g, `<@${message.author.id}>`).replace(/{level}/g, level).replace(/{server}/g, message.guild.name);

  if (config.leveling.messageMode === 'dm') {
    await message.author.send(text).catch(() => {});
    return;
  }

  const channel = config.leveling.channel ? message.guild.channels.cache.get(config.leveling.channel) : message.channel;
  await (channel ?? message.channel).send(text).catch(() => {});
}

async function handleMessageXp(message) {
  const config = getConfig(message.guild.id);
  if (!config.leveling.enabled) return;
  if (config.leveling.ignoredChannels.includes(message.channel.id)) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (now - (lastXpAt.get(key) ?? 0) < XP_COOLDOWN_MS) return;
  lastXpAt.set(key, now);

  const currentXp = getXp(message.guild.id, message.author.id);
  const before = levelFromTotalXp(currentXp).level;
  const gain = Math.round((XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1))) * config.leveling.rate);
  addXpStmt.run(message.guild.id, message.author.id, gain);
  const after = levelFromTotalXp(currentXp + gain).level;

  if (after > before) {
    await announceLevel(message, config, after);
    if (message.member) await applyLevelRoles(message.member, after);
  }
}

function setLevel(guildId, userId, level) {
  const xp = totalXpForLevel(Math.max(level, 0));
  setXpStmt.run(guildId, userId, xp);
  return xp;
}

function setXp(guildId, userId, xp) {
  const value = Math.max(Math.round(xp), 0);
  setXpStmt.run(guildId, userId, value);
  return levelFromTotalXp(value).level;
}

function leaderboard(guildId, limit = 10) {
  return topXpStmt.all(guildId, limit).map((row) => ({ userId: row.user_id, xp: row.xp, level: levelFromTotalXp(row.xp).level }));
}

// Position on the leaderboard without pulling the whole table.
function rankOf(guildId, userId) {
  const xp = getXp(guildId, userId);
  if (xp <= 0) return { xp: 0, position: 0 };
  return { xp, position: rankStmt.get(guildId, xp).ahead + 1 };
}

// Only used by `levels sync`, which is an explicit admin action.
function allRankedUsers(guildId) {
  return allXpStmt.all(guildId).map((row) => ({ userId: row.user_id, xp: row.xp }));
}

module.exports = { handleMessageXp, levelFromTotalXp, totalXpForLevel, setLevel, setXp, getXp, rankOf, allRankedUsers, leaderboard, applyLevelRoles };
