const { getConfig, saveConfig } = require('../config/database');

const XP_COOLDOWN_MS = 60000;
const XP_MIN = 15;
const XP_MAX = 25;

const lastXpAt = new Map();

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

function getUser(config, userId) {
  if (!config.leveling.users[userId]) config.leveling.users[userId] = { xp: 0 };
  return config.leveling.users[userId];
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

  const user = getUser(config, message.author.id);
  const before = levelFromTotalXp(user.xp).level;
  const gain = Math.round((XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1))) * config.leveling.rate);
  user.xp += gain;
  const after = levelFromTotalXp(user.xp).level;
  saveConfig(message.guild.id);

  if (after > before) {
    await announceLevel(message, config, after);
    if (message.member) await applyLevelRoles(message.member, after);
  }
}

function setLevel(guildId, userId, level) {
  const config = getConfig(guildId);
  const user = getUser(config, userId);
  user.xp = totalXpForLevel(Math.max(level, 0));
  saveConfig(guildId);
  return user.xp;
}

function setXp(guildId, userId, xp) {
  const config = getConfig(guildId);
  const user = getUser(config, userId);
  user.xp = Math.max(xp, 0);
  saveConfig(guildId);
  return levelFromTotalXp(user.xp).level;
}

function leaderboard(guildId, limit = 10) {
  const config = getConfig(guildId);
  return Object.entries(config.leveling.users)
    .map(([userId, data]) => ({ userId, xp: data.xp, level: levelFromTotalXp(data.xp).level }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

module.exports = { handleMessageXp, levelFromTotalXp, totalXpForLevel, setLevel, setXp, leaderboard, applyLevelRoles };
