const { baseEmbed, COLORS } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');

const CATEGORY = 'Fun';

const EIGHTBALL_RESPONSES = [
  'It is certain.',
  'Without a doubt.',
  'Yes, definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
];

module.exports = [
  {
    name: '8ball',
    category: CATEGORY,
    description: 'Ask the magic 8-ball a question. Usage: 8ball <question>',
    async execute(message, args) {
      if (args.length === 0) return message.reply('Usage: `8ball <question>`');
      const response = EIGHTBALL_RESPONSES[Math.floor(Math.random() * EIGHTBALL_RESPONSES.length)];
      return message.channel.send({
        embeds: [baseEmbed().setTitle('🎱 Magic 8-Ball').addFields({ name: 'Question', value: args.join(' ') }, { name: 'Answer', value: response })],
      });
    },
  },
  {
    name: 'coinflip',
    aliases: ['flip'],
    category: CATEGORY,
    description: 'Flip a coin.',
    async execute(message) {
      return message.channel.send(`🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}!`);
    },
  },
  {
    name: 'roll',
    category: CATEGORY,
    description: 'Roll dice. Usage: roll [NdM] (default 1d6)',
    async execute(message, args) {
      const match = /^(\d*)d(\d+)$/i.exec(args[0] ?? '1d6');
      if (!match) return message.reply('Usage: `roll [NdM]`, e.g. `roll 2d6` (max 20 dice, 1000 sides).');
      const count = Math.min(parseInt(match[1] || '1', 10), 20);
      const sides = Math.min(parseInt(match[2], 10), 1000);
      if (!count || !sides) return message.reply('Usage: `roll [NdM]`, e.g. `roll 2d6`.');
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      return message.channel.send(`🎲 Rolled ${count}d${sides}: ${rolls.join(', ')} (total: ${total})`);
    },
  },
  {
    name: 'rps',
    category: CATEGORY,
    description: 'Play rock-paper-scissors. Usage: rps <rock|paper|scissors>',
    async execute(message, args) {
      const choices = ['rock', 'paper', 'scissors'];
      const player = args[0]?.toLowerCase();
      if (!choices.includes(player)) return message.reply('Usage: `rps <rock|paper|scissors>`');
      const bot = choices[Math.floor(Math.random() * choices.length)];
      let result;
      if (player === bot) result = "It's a tie!";
      else if ((player === 'rock' && bot === 'scissors') || (player === 'paper' && bot === 'rock') || (player === 'scissors' && bot === 'paper')) {
        result = 'You win!';
      } else {
        result = 'I win!';
      }
      return message.channel.send(`You chose **${player}**, I chose **${bot}**. ${result}`);
    },
  },
  {
    name: 'poll',
    category: CATEGORY,
    description: 'Start a quick yes/no poll. Usage: poll <question>',
    async execute(message, args) {
      if (args.length === 0) return message.reply('Usage: `poll <question>`');
      const embed = baseEmbed(COLORS.primary).setTitle('📊 Poll').setDescription(args.join(' ')).setFooter({ text: `Started by ${message.author.tag}` });
      const poll = await message.channel.send({ embeds: [embed] });
      await poll.react('👍');
      await poll.react('👎');
    },
  },
  {
    name: 'remind',
    category: CATEGORY,
    description: 'Set a reminder. Usage: remind <duration> <text>, e.g. remind 10m take a break',
    async execute(message, args) {
      const match = /^(\d+)([smhd])$/i.exec(args[0] ?? '');
      const text = args.slice(1).join(' ');
      if (!match || !text) return message.reply('Usage: `remind <duration> <text>`, e.g. `remind 10m take a break`.');
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      const ms = parseInt(match[1], 10) * multipliers[match[2].toLowerCase()];
      if (ms > 30 * 86400000) return message.reply('Reminders can be at most 30 days out.');
      await message.reply(`Okay, I'll remind you about "${text}" <t:${Math.floor((Date.now() + ms) / 1000)}:R>.`);
      setTimeout(() => {
        message.channel.send(`⏰ ${message.author}, reminder: ${text}`).catch(() => {});
      }, ms);
    },
  },
  {
    name: 'hug',
    category: CATEGORY,
    description: 'Hug someone with a gif. Usage: hug @user',
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `hug @user`');
      const embed = baseEmbed(COLORS.primary).setDescription(`🤗 ${message.author} hugs ${user}!`);
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'kiss',
    category: CATEGORY,
    description: 'Kiss someone with a gif. Usage: kiss @user',
    async execute(message, args) {
      const user = await resolveUser(message, args[0]);
      if (!user) return message.reply('Usage: `kiss @user`');
      const embed = baseEmbed(COLORS.primary).setDescription(`💋 ${message.author} kisses ${user}!`);
      return message.channel.send({ embeds: [embed] });
    },
  },
];
