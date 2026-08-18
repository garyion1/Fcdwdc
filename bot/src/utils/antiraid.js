const { ChannelType } = require('discord.js');
const { lockChannel, unlockChannel } = require('./channelLock');
const { logAction } = require('./logger');
const { baseEmbed, COLORS } = require('./embeds');

const joinTimestamps = new Map();
const raidState = new Map();

function recordJoin(guildId, windowSeconds) {
  const now = Date.now();
  const timestamps = (joinTimestamps.get(guildId) ?? []).filter((t) => now - t < windowSeconds * 1000);
  timestamps.push(now);
  joinTimestamps.set(guildId, timestamps);
  return timestamps.length;
}

function isRaidActive(guildId) {
  return raidState.get(guildId)?.active ?? false;
}

async function triggerRaidMode(guild, config) {
  if (isRaidActive(guild.id)) return;
  raidState.set(guild.id, { active: true, lockedChannelIds: [] });

  const lockedChannelIds = [];
  if (config.antiraid.lockdownOnRaid) {
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
    for (const channel of textChannels.values()) {
      const result = await lockChannel(channel, guild.client.user, 'Anti-raid: automatic lockdown').catch(() => null);
      if (result && !result.alreadyLocked) lockedChannelIds.push(channel.id);
    }
  }
  raidState.set(guild.id, { active: true, lockedChannelIds });

  const alertChannel = config.antiraid.alertChannel ? guild.channels.cache.get(config.antiraid.alertChannel) : null;
  const embed = baseEmbed(COLORS.danger)
    .setTitle('🚨 Raid Detected')
    .setDescription(
      `A burst of joins triggered anti-raid protection.${
        config.antiraid.lockdownOnRaid ? `\n${lockedChannelIds.length} channel(s) were locked.` : ''
      }\nUse \`/antiraid end\` (or \`,antiraid end\`) once things are safe.`,
    );
  if (alertChannel) await alertChannel.send({ embeds: [embed] }).catch(() => {});
  await logAction(guild, `🚨 Anti-raid triggered — ${lockedChannelIds.length} channel(s) locked`);
}

async function endRaidMode(guild, moderator) {
  const state = raidState.get(guild.id);
  if (!state?.active) return { notActive: true };

  for (const channelId of state.lockedChannelIds) {
    const channel = guild.channels.cache.get(channelId);
    if (channel) await unlockChannel(channel, moderator).catch(() => {});
  }
  raidState.delete(guild.id);
  await logAction(guild, `✅ Anti-raid mode ended by ${moderator.tag}`);
  return { notActive: false };
}

module.exports = { recordJoin, isRaidActive, triggerRaidMode, endRaidMode };
