const { fetchImage, fetchRedditImage } = require('../utils/imageSources');

const CATEGORY = 'Images';

// Every kind already tries several sources internally — reaching this means
// all of them failed, which almost always means the host isn't reaching the
// outside internet at all (a network policy on the hosting panel), not that
// one API happened to be down.
const NO_SOURCE_MESSAGE =
  'None of the image services responded. I tried more than one source, so this usually means your hosting panel is blocking outbound internet access to sites other than Discord — check with their support that outbound HTTPS is allowed.';

const KINDS = [
  { name: 'meme', label: 'meme', emoji: '😂' },
  { name: 'cat', label: 'cat', emoji: '🐱' },
  { name: 'dog', label: 'dog', emoji: '🐶' },
  { name: 'fox', label: 'fox', emoji: '🦊' },
  { name: 'panda', label: 'panda', emoji: '🐼' },
  { name: 'bird', label: 'bird', emoji: '🐦' },
  { name: 'frog', label: 'frog', emoji: '🐸' },
  { name: 'duck', label: 'duck', emoji: '🦆' },
];

const commands = KINDS.map(({ name, label, emoji }) => ({
  name,
  category: CATEGORY,
  description: `Get a random ${label}.`,
  async execute(message) {
    const result = await fetchImage(name);
    if (!result?.url) return message.reply(NO_SOURCE_MESSAGE);
    // Sent as plain content so Discord renders the image or GIF inline.
    return message.channel.send(`${emoji} ${result.url}`).catch(() => {});
  },
}));

commands.push({
  name: 'reddit',
  category: CATEGORY,
  description: 'Get a random image from a subreddit. Usage: reddit <subreddit>',
  async execute(message, args) {
    const subreddit = args[0]?.replace(/^\/?r\//i, '').trim();
    if (!subreddit || !/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) return message.reply('Usage: `reddit <subreddit>` e.g. `reddit aww`');

    const result = await fetchRedditImage(subreddit).catch(() => null);
    if (!result?.url) return message.reply(`I could not find a loadable image in r/${subreddit} — it may be empty, private, text-only, or not exist.`);
    return message.channel.send(`**${result.title}**\n${result.url}`).catch(() => {});
  },
});

module.exports = commands;
