const { isBotUsable } = require('../utils/premium');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'emojiCreate',
  async execute(emoji) {
    if (!isBotUsable(emoji.guild.id)) return;
    await logEvent(emoji.guild, 'emojis', `➕ Emoji ${emoji} **:${emoji.name}:** was added.`);
  },
};
