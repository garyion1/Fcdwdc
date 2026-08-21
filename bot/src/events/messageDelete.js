const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');
const { recordDeleted } = require('../utils/snipe');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;
    if (!isBotUsable(message.guild.id)) return;

    recordDeleted(message.channel.id, {
      content: message.content ?? '',
      authorTag: message.author ? message.author.tag : 'Unknown',
      authorAvatar: message.author ? message.author.displayAvatarURL() : null,
      timestamp: Date.now(),
    });

    const config = getConfig(message.guild.id);
    if (!config.logChannel) return;
    const channel = message.guild.channels.cache.get(config.logChannel);
    if (!channel) return;

    const content = message.content?.length ? message.content : '*[no cached content]*';
    await channel
      .send({
        embeds: [
          baseEmbed(COLORS.danger)
            .setTitle('Message deleted')
            .setDescription(`**Author:** ${message.author ? message.author.tag : 'Unknown'}\n**Channel:** ${message.channel}\n**Content:** ${content}`),
        ],
      })
      .catch(() => {});
  },
};
