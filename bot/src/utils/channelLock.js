const { PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { logAction } = require('./logger');

const LOCK_FLAGS = ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads'];

function getPermissionState(overwrite, flag) {
  if (!overwrite) return null;
  if (overwrite.allow.has(PermissionFlagsBits[flag])) return true;
  if (overwrite.deny.has(PermissionFlagsBits[flag])) return false;
  return null;
}

async function lockChannel(channel, moderator, reason = 'No reason provided') {
  const config = getConfig(channel.guild.id);
  if (config.locks[channel.id]) return { alreadyLocked: true };

  const everyone = channel.guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const previous = {};
  for (const flag of LOCK_FLAGS) previous[flag] = getPermissionState(overwrite, flag);

  await channel.permissionOverwrites.edit(
    everyone,
    {
      SendMessages: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false,
    },
    { reason: `Locked by ${moderator.tag}: ${reason}` },
  );

  const lockedThreadIds = [];
  const activeThreads = channel.threads?.cache.filter((t) => !t.archived && !t.locked) ?? new Map();
  for (const thread of activeThreads.values()) {
    await thread.setLocked(true, `Parent channel locked by ${moderator.tag}`).catch(() => {});
    lockedThreadIds.push(thread.id);
  }

  config.locks[channel.id] = { previous, lockedThreadIds, lockedBy: moderator.id, reason, lockedAt: Date.now() };
  saveConfig(channel.guild.id);

  await logAction(channel.guild, `🔒 ${channel} was locked by ${moderator.tag}\nReason: ${reason}`);
  return { alreadyLocked: false };
}

async function unlockChannel(channel, moderator) {
  const config = getConfig(channel.guild.id);
  const lock = config.locks[channel.id];
  if (!lock) return { notLocked: true };

  const everyone = channel.guild.roles.everyone;
  await channel.permissionOverwrites.edit(everyone, lock.previous, { reason: `Unlocked by ${moderator.tag}` }).catch(() => {});

  for (const threadId of lock.lockedThreadIds ?? []) {
    const thread = channel.threads?.cache.get(threadId);
    if (thread) await thread.setLocked(false, `Parent channel unlocked by ${moderator.tag}`).catch(() => {});
  }

  delete config.locks[channel.id];
  saveConfig(channel.guild.id);

  await logAction(channel.guild, `🔓 ${channel} was unlocked by ${moderator.tag}`);
  return { notLocked: false };
}

module.exports = { lockChannel, unlockChannel };
