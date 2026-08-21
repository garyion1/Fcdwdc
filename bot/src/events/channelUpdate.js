const { isBotUsable } = require('../utils/premium');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild || !isBotUsable(newChannel.guild.id)) return;
    if (oldChannel.name === newChannel.name) return;
    await logEvent(newChannel.guild, 'channels', `✏️ Channel **#${oldChannel.name}** was renamed to **#${newChannel.name}**.`);
  },
};
