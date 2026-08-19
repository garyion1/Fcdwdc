const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { logAction } = require('./logger');

async function denyRoleOnAllChannels(guild, role, jailChannel) {
  for (const channel of guild.channels.cache.values()) {
    if (channel.id === jailChannel.id) continue;
    await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
  }
}

async function ensureJailSetup(guild) {
  const config = getConfig(guild.id);

  let role = config.jail.roleId ? guild.roles.cache.get(config.jail.roleId) : null;
  if (!role) {
    role = await guild.roles.create({
      name: 'Jailed',
      color: 0x2b2d31,
      permissions: [],
      reason: 'Boat Bot jail system setup',
    });
    config.jail.roleId = role.id;
    saveConfig(guild.id);
  }

  let channel = config.jail.channelId ? guild.channels.cache.get(config.jail.channelId) : null;
  if (!channel) {
    channel = await guild.channels.create({
      name: 'jail',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
      reason: 'Boat Bot jail system setup',
    });
    config.jail.channelId = channel.id;
    saveConfig(guild.id);
  }

  await denyRoleOnAllChannels(guild, role, channel);
  return { role, channel };
}

async function jailMember(guild, member, moderator, reason) {
  const config = getConfig(guild.id);
  if (config.jail.jailed[member.id]) return { alreadyJailed: true };
  if (!member.manageable) return { hierarchyError: true };

  const { role, channel } = await ensureJailSetup(guild);

  const previousRoleIds = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
  try {
    await member.roles.set([role.id], `Jailed by ${moderator.tag}: ${reason}`);
  } catch {
    return { hierarchyError: true };
  }

  config.jail.jailed[member.id] = { moderatorId: moderator.id, reason, jailedAt: Date.now(), previousRoleIds };
  saveConfig(guild.id);

  await logAction(guild, `🔒 ${member.user.tag} was jailed by ${moderator.tag}\nReason: ${reason}`);
  return { alreadyJailed: false, channel };
}

async function unjailMember(guild, member, moderator) {
  const config = getConfig(guild.id);
  const record = config.jail.jailed[member.id];
  if (!record) return { notJailed: true };

  const restoreRoleIds = record.previousRoleIds.filter((id) => guild.roles.cache.has(id));
  await member.roles.set(restoreRoleIds, `Unjailed by ${moderator.tag}`).catch(() => {});

  delete config.jail.jailed[member.id];
  saveConfig(guild.id);

  await logAction(guild, `🔓 ${member.user.tag} was unjailed by ${moderator.tag}`);
  return { notJailed: false };
}

module.exports = { ensureJailSetup, denyRoleOnAllChannels, jailMember, unjailMember };
