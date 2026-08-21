const { AuditLogEvent } = require('discord.js');
const { isBotUsable } = require('../utils/premium');
const { handleAntinukeEvent } = require('../utils/antinuke');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'emojiDelete',
  async execute(emoji) {
    if (!isBotUsable(emoji.guild.id)) return;
    await logEvent(emoji.guild, 'emojis', `🗑️ Emoji **:${emoji.name}:** was deleted.`);
    await handleAntinukeEvent(emoji.guild, 'emoji', AuditLogEvent.EmojiDelete, `:${emoji.name}:`);
  },
};
