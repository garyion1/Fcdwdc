const { isBotUsable } = require('../utils/premium');
const { handleVoiceStateUpdate } = require('../utils/voicemaster');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild || !isBotUsable(guild.id)) return;

    const member = newState.member ?? oldState.member;
    if (member && oldState.channelId !== newState.channelId) {
      if (!oldState.channelId) await logEvent(guild, 'voice', `🔊 **${member.user.tag}** joined <#${newState.channelId}>.`);
      else if (!newState.channelId) await logEvent(guild, 'voice', `🔇 **${member.user.tag}** left <#${oldState.channelId}>.`);
      else await logEvent(guild, 'voice', `🔀 **${member.user.tag}** moved to <#${newState.channelId}>.`);
    }

    await handleVoiceStateUpdate(oldState, newState);
  },
};
