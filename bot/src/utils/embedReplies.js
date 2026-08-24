const { baseEmbed } = require('./embeds');

// Every command reply goes out as an embed, with two deliberate exceptions:
// roleplay actions and meme/animal images, whose whole point is the media
// rendering inline with a plain line of text above it.
//
// Doing this in the dispatcher rather than at ~290 individual call sites means
// one place to reason about, and a command can't accidentally miss it.
const RAW_CATEGORIES = new Set(['Actions', 'Images']);

const EMBED_DESCRIPTION_LIMIT = 4096;

function usesRawReplies(command) {
  if (!command) return false;
  if (command.rawReply === true) return true;
  return RAW_CATEGORIES.has(command.category);
}

// Converts a bare string (or a content-only object) into an embed. Anything
// already carrying an embed, a file, or components is passed straight through
// — those were built deliberately and must not be rewritten.
function toEmbed(payload, color) {
  if (typeof payload === 'string') {
    if (!payload.trim()) return payload;
    return { embeds: [baseEmbed(color).setDescription(payload.slice(0, EMBED_DESCRIPTION_LIMIT))] };
  }

  if (!payload || typeof payload !== 'object') return payload;
  if (payload.embeds?.length || payload.files?.length || payload.components?.length) return payload;
  if (typeof payload.content !== 'string' || !payload.content.trim()) return payload;

  // allowedMentions is dropped on purpose: embeds never ping, so the flag it
  // was guarding against no longer applies.
  const { content, allowedMentions, ...rest } = payload;
  return { ...rest, embeds: [baseEmbed(color).setDescription(content.slice(0, EMBED_DESCRIPTION_LIMIT))] };
}

// Proxies reply/send on a message without mutating the real message or its
// (shared, cached) channel.
function embedMessageReplies(message, color) {
  const channel = new Proxy(message.channel, {
    get(target, prop, receiver) {
      if (prop === 'send') return (payload) => target.send(toEmbed(payload, color));
      return Reflect.get(target, prop, receiver);
    },
  });

  return new Proxy(message, {
    get(target, prop, receiver) {
      if (prop === 'reply') return (payload) => target.reply(toEmbed(payload, color));
      if (prop === 'channel') return channel;
      return Reflect.get(target, prop, receiver);
    },
  });
}

function embedInteractionReplies(interaction, color) {
  const WRAPPED = new Set(['reply', 'followUp', 'editReply']);
  return new Proxy(interaction, {
    get(target, prop, receiver) {
      if (WRAPPED.has(prop)) return (payload) => target[prop](toEmbed(payload, color));
      return Reflect.get(target, prop, receiver);
    },
  });
}

module.exports = { embedMessageReplies, embedInteractionReplies, toEmbed, usesRawReplies, RAW_CATEGORIES };
