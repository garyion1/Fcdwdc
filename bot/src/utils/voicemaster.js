const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');

function isOwner(config, channelId, userId) {
  return config.voicemaster.active[channelId] === userId;
}

// Returns the temp channel the member currently sits in, if they own it.
function ownedChannel(member) {
  const config = getConfig(member.guild.id);
  const channel = member.voice?.channel;
  if (!channel) return { error: 'You need to be in a voice channel.' };
  if (!config.voicemaster.active[channel.id]) return { error: 'That is not a VoiceMaster channel.' };
  if (!isOwner(config, channel.id, member.id)) return { error: 'You do not own this voice channel.' };
  return { channel, config };
}

async function createTempChannel(member) {
  const guild = member.guild;
  const config = getConfig(guild.id);

  const name = config.voicemaster.defaultName.replace(/{user}/g, member.displayName).replace(/{count}/g, Object.keys(config.voicemaster.active).length + 1);

  const parent = config.voicemaster.categoryId ? guild.channels.cache.get(config.voicemaster.categoryId) : member.voice.channel?.parent;

  const channel = await guild.channels
    .create({
      name: name.slice(0, 100),
      type: ChannelType.GuildVoice,
      parent: parent?.id ?? null,
      bitrate: Math.min((config.voicemaster.defaultBitrate ?? 64) * 1000, guild.maximumBitrate),
      rtcRegion: config.voicemaster.defaultRegion ?? null,
      permissionOverwrites: [
        {
          id: member.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Connect],
        },
      ],
    })
    .catch(() => null);

  if (!channel) return null;

  config.voicemaster.active[channel.id] = member.id;
  saveConfig(guild.id);

  await member.voice.setChannel(channel).catch(() => {});

  if (config.voicemaster.joinRole) {
    const role = guild.roles.cache.get(config.voicemaster.joinRole);
    if (role?.editable) await member.roles.add(role, 'VoiceMaster join role').catch(() => {});
  }

  return channel;
}

async function cleanupTempChannel(guild, channelId) {
  const config = getConfig(guild.id);
  if (!config.voicemaster.active[channelId]) return;

  const channel = guild.channels.cache.get(channelId);
  if (channel && channel.members.size > 0) return;

  delete config.voicemaster.active[channelId];
  saveConfig(guild.id);
  if (channel) await channel.delete('VoiceMaster channel empty').catch(() => {});
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild ?? oldState.guild;
  const config = getConfig(guild.id);
  if (!config.voicemaster.enabled) return;

  // Joined the "join to create" channel.
  if (newState.channelId && newState.channelId === config.voicemaster.joinChannel && newState.member) {
    await createTempChannel(newState.member).catch((error) => console.error('VoiceMaster create error:', error));
  }

  // Left a temp channel — delete it once it empties out.
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await cleanupTempChannel(guild, oldState.channelId).catch(() => {});

    if (config.voicemaster.joinRole && oldState.member) {
      const stillInTemp = newState.channelId && config.voicemaster.active[newState.channelId];
      if (!stillInTemp) {
        const role = guild.roles.cache.get(config.voicemaster.joinRole);
        if (role?.editable) await oldState.member.roles.remove(role, 'Left VoiceMaster channel').catch(() => {});
      }
    }
  }
}

// Drop temp channels that emptied out while the bot was offline.
async function pruneTempChannels(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = getConfig(guild.id);
    if (Object.keys(config.voicemaster.active).length === 0) continue;

    let dirty = false;
    for (const channelId of Object.keys(config.voicemaster.active)) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        delete config.voicemaster.active[channelId];
        dirty = true;
        continue;
      }
      if (channel.members.size === 0) {
        delete config.voicemaster.active[channelId];
        dirty = true;
        await channel.delete('VoiceMaster channel empty on startup').catch(() => {});
      }
    }
    if (dirty) saveConfig(guild.id);
  }
}

module.exports = { handleVoiceStateUpdate, pruneTempChannels, ownedChannel, isOwner };
