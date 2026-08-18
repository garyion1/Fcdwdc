const { getGuild } = require('../database');
const { logAction } = require('../utils/logger');

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    const settings = getGuild(message.guild.id);

    if (settings.automod.enabled) {
      const content = message.content.toLowerCase();
      const hasBannedWord = settings.automod.bannedWords.some((word) => content.includes(word));
      const hasInvite = settings.automod.blockInvites && INVITE_REGEX.test(message.content);

      if (hasBannedWord || hasInvite) {
        await message.delete().catch(() => {});
        await logAction(message.guild, {
          title: 'Automod action',
          description: `Deleted a message from ${message.author.tag} in ${message.channel}\nReason: ${hasInvite ? 'Invite link' : 'Banned word'}`,
          color: 0xed4245,
        });
        return;
      }
    }

    const trigger = message.content.trim().toLowerCase();
    if (settings.customCommands[trigger]) {
      message.channel.send(settings.customCommands[trigger]).catch(() => {});
    }
  },
};
