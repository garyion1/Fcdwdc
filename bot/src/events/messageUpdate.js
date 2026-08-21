const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');
const { recordEdited } = require('../utils/snipe');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!isBotUsable(newMessage.guild.id)) return;

    recordEdited(newMessage.channel.id, {
      before: oldMessage.content ?? '',
      after: newMessage.content ?? '',
      authorTag: newMessage.author ? newMessage.author.tag : 'Unknown',
      authorAvatar: newMessage.author ? newMessage.author.displayAvatarURL() : null,
      timestamp: Date.now(),
    });

    const config = getConfig(newMessage.guild.id);
    if (!config.logChannel) return;
    const channel = newMessage.guild.channels.cache.get(config.logChannel);
    if (!channel) return;

    await channel
      .send({
        embeds: [
          baseEmbed(COLORS.warning)
            .setTitle('Message edited')
            .setDescription(`**Author:** ${newMessage.author.tag}\n**Channel:** ${newMessage.channel}`)
            .addFields(
              { name: 'Before', value: (oldMessage.content || '*[unknown]*').slice(0, 1024) },
              { name: 'After', value: (newMessage.content || '*[unknown]*').slice(0, 1024) },
            ),
        ],
      })
      .catch(() => {});
  },
};
