const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

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
