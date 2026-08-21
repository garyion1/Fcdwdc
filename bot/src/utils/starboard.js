const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('./embeds');

function firstImage(message) {
  const attachment = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (attachment) return attachment.url;
  const embedImage = message.embeds.find((e) => e.image || e.thumbnail);
  return embedImage?.image?.url ?? embedImage?.thumbnail?.url ?? null;
}

function buildStarEmbed(config, message, count) {
  const embed = baseEmbed(config.starboard.color ?? COLORS.warning)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || '*No text content*');

  if (config.starboard.jumpUrl) embed.addFields({ name: 'Source', value: `[Jump to message](${message.url})` });
  if (config.starboard.attachments) {
    const image = firstImage(message);
    if (image) embed.setImage(image);
  }
  if (!config.starboard.timestamp) embed.setTimestamp(null);

  embed.setFooter({ text: `${config.starboard.emoji} ${count} • #${message.channel.name}` });
  return embed;
}

async function syncStarboard(reaction) {
  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message?.guild || message.author?.bot) return;

  const config = getConfig(message.guild.id);
  if (!config.starboard.channel) return;
  if (reaction.emoji.name !== config.starboard.emoji && reaction.emoji.toString() !== config.starboard.emoji) return;

  const board = message.guild.channels.cache.get(config.starboard.channel);
  if (!board || board.id === message.channel.id) return;

  let count = reaction.count ?? 0;
  if (!config.starboard.selfStar) {
    const users = await reaction.users.fetch().catch(() => null);
    if (users?.has(message.author.id)) count -= 1;
  }

  const existingId = config.starboard.posts[message.id];

  if (count < config.starboard.threshold) {
    // Dropped back below the bar — take the starboard post down again.
    if (existingId) {
      const post = await board.messages.fetch(existingId).catch(() => null);
      if (post) await post.delete().catch(() => {});
      delete config.starboard.posts[message.id];
      saveConfig(message.guild.id);
    }
    return;
  }

  const embed = buildStarEmbed(config, message, count);

  if (existingId) {
    const post = await board.messages.fetch(existingId).catch(() => null);
    if (post) {
      await post.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  const post = await board.send({ embeds: [embed] }).catch(() => null);
  if (post) {
    config.starboard.posts[message.id] = post.id;
    saveConfig(message.guild.id);
  }
}

module.exports = { syncStarboard };
