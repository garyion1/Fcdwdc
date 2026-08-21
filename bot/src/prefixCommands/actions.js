const { resolveUser } = require('../utils/args');
const { fetchActionGif } = require('../utils/reactionGifs');

const CATEGORY = 'Actions';

// Each action is the same command with different wording, so they are built
// from one table rather than written out twenty times.
//
// `targeted` actions read like "A hugs B" and take a member; the rest are
// things you just do, so a target is optional flavour ("A waves at B").
const ACTIONS = [
  { name: 'hug', targeted: true, verb: 'hugs', solo: 'needs a hug' },
  { name: 'kiss', targeted: true, verb: 'kisses', solo: 'blows a kiss' },
  { name: 'slap', targeted: true, verb: 'slaps', solo: 'slaps the air' },
  { name: 'pat', targeted: true, verb: 'pats', solo: 'pats themselves on the back' },
  { name: 'cuddle', targeted: true, verb: 'cuddles', solo: 'wants to cuddle' },
  { name: 'poke', targeted: true, verb: 'pokes', solo: 'pokes at nothing' },
  { name: 'highfive', targeted: true, verb: 'high-fives', solo: 'is waiting for a high five' },
  { name: 'bonk', targeted: true, verb: 'bonks', solo: 'bonks themselves' },
  { name: 'bite', targeted: true, verb: 'bites', solo: 'bites the air' },
  { name: 'punch', targeted: true, verb: 'punches', solo: 'throws a punch' },
  { name: 'lick', targeted: true, verb: 'licks', solo: 'licks the air' },
  { name: 'stare', targeted: true, verb: 'stares at', solo: 'stares into the distance' },
  { name: 'smile', targeted: false, verb: 'smiles at', solo: 'smiles' },
  { name: 'wave', targeted: false, verb: 'waves at', solo: 'waves' },
  { name: 'cry', targeted: false, verb: 'cries at', solo: 'is crying' },
  { name: 'laugh', targeted: false, verb: 'laughs at', solo: 'bursts out laughing' },
  { name: 'angry', targeted: false, verb: 'is angry at', solo: 'is furious' },
  { name: 'blush', targeted: false, verb: 'blushes at', solo: 'is blushing' },
  { name: 'dance', targeted: false, verb: 'dances with', solo: 'starts dancing' },
];

module.exports = ACTIONS.map(({ name, targeted, verb, solo }) => ({
  name,
  category: CATEGORY,
  description: `${targeted ? `Usage: ${name} @user` : `Usage: ${name} [@user]`}`,
  async execute(message, args) {
    const target = await resolveUser(message, args[0]);

    if (targeted && !target) return message.reply(`Usage: \`${name} @user\``);

    const text =
      target && target.id === message.author.id
        ? `**${message.author.username}** ${solo}.`
        : target
          ? `**${message.author.username}** ${verb} **${target.username}**!`
          : `**${message.author.username}** ${solo}.`;

    const gif = await fetchActionGif(name);

    // The GIF goes in the message content so Discord renders it inline. If
    // every source failed the line still lands — better than an error for a
    // fun command — with a short note so a broken network is visible in
    // Discord itself, not just server logs.
    const line = gif ? `${text}\n${gif}` : `${text}\n-# *(gif unavailable — the image services could not be reached)*`;
    return message.channel.send(line).catch(() => {});
  },
}));
