// Adds a short decorative emoji+tagline flourish to every command reply,
// without ever touching the real content a command built. Two rules keep
// this safe everywhere it's used:
//   1. String replies get the flourish PREPENDED as its own line — the
//      original text follows completely untouched, so a code block, a raw
//      gif URL on its own line, or anything else a command carefully built
//      survives byte-for-byte.
//   2. Embeds only gain an emoji on the title (skipped if one is already
//      there) and a default footer (skipped if one is already set) —
//      description, fields, color, and everything else are left alone, so
//      nothing can push a description over Discord's length limit or lose
//      information a command deliberately put there.

const FLAIR_EMOJIS = ['✨', '🎉', '⚡', '🌟', '🚀', '💫', '🔥', '🎯', '💎', '🌈', '🛠️', '📌', '🎊', '🍀', '👌', '🙌'];
const FLAIR_TAGLINES = [
  'Here you go!',
  'All done!',
  "That's sorted.",
  'Boom — handled.',
  'Glad to help!',
  'Consider it done.',
  "You're all set.",
  'Anything else, just ask!',
  'Easy — taken care of.',
  'On it, and done!',
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function flairLine() {
  return `${pick(FLAIR_EMOJIS)} ${pick(FLAIR_TAGLINES)}`;
}

function isEmojiStart(text) {
  return /^\p{Extended_Pictographic}/u.test(text ?? '');
}

const MAX_MESSAGE_LENGTH = 2000;

function flairString(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  const withFlair = `${flairLine()}\n${text}`;
  return withFlair.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : withFlair;
}

function flairEmbed(embed) {
  const { EmbedBuilder } = require('discord.js');
  const builder = EmbedBuilder.from(embed);
  const data = builder.data;

  if (data.title && !isEmojiStart(data.title)) {
    const prefixed = `${pick(FLAIR_EMOJIS)} ${data.title}`;
    builder.setTitle(prefixed.length > 256 ? prefixed.slice(0, 256) : prefixed);
  }
  if (!data.footer) {
    builder.setFooter({ text: flairLine() });
  }

  return builder;
}

function flairPayload(payload) {
  if (typeof payload === 'string') return flairString(payload);
  if (!payload || typeof payload !== 'object') return payload;

  let next = payload;
  if (Array.isArray(next.embeds) && next.embeds.length > 0) {
    next = { ...next, embeds: next.embeds.map(flairEmbed) };
  }
  if (typeof next.content === 'string') {
    next = { ...next, content: flairString(next.content) };
  }
  return next;
}

// Wraps a discord.js Message in a Proxy that flairs anything sent through
// `.reply()` or `.channel.send()`, without ever mutating the real message or
// its (long-lived, cached) channel — safe under concurrent message handling.
function flairMessage(message) {
  const flairedChannel = new Proxy(message.channel, {
    get(target, prop, receiver) {
      if (prop === 'send') return (payload) => target.send(flairPayload(payload));
      return Reflect.get(target, prop, receiver);
    },
  });

  return new Proxy(message, {
    get(target, prop, receiver) {
      if (prop === 'reply') return (payload) => target.reply(flairPayload(payload));
      if (prop === 'channel') return flairedChannel;
      return Reflect.get(target, prop, receiver);
    },
  });
}

// Same idea for a slash command's interaction: reply/followUp/editReply all
// carry user-facing content worth flairing.
function flairInteraction(interaction) {
  const FLAIRED_METHODS = new Set(['reply', 'followUp', 'editReply']);
  return new Proxy(interaction, {
    get(target, prop, receiver) {
      if (FLAIRED_METHODS.has(prop)) return (payload) => target[prop](flairPayload(payload));
      return Reflect.get(target, prop, receiver);
    },
  });
}

module.exports = { flairPayload, flairString, flairEmbed, flairMessage, flairInteraction };
