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
    name: 'dice',
    category: CATEGORY,
    description: 'Roll dice. Usage: dice [count] [sides] (default 1d6)',
    async execute(message, args) {
      const count = Math.min(Math.max(parseInt(args[0], 10) || 1, 1), 25);
      const sides = Math.min(Math.max(parseInt(args[1], 10) || 6, 2), 1000);
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((sum, r) => sum + r, 0);
      const detail = count > 1 ? `\n${rolls.join(' + ')} = **${total}**` : '';
      return message.channel.send({
        embeds: [baseEmbed().setTitle('🎲 Dice').setDescription(`Rolling **${count}d${sides}**${detail || `\nYou rolled **${total}**`}`)],
      });
    },
  },
  {
    name: 'choose',
    aliases: ['pick'],
    category: CATEGORY,
    description: 'Let the bot pick for you. Usage: choose <option> | <option> | ...',
    async execute(message, args) {
      const options = args.join(' ').split(/\s*[|,]\s*/).map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) return message.reply('Give me at least two options: `choose pizza | pasta | sushi`');
      const picked = options[Math.floor(Math.random() * options.length)];
      return message.channel.send({ embeds: [baseEmbed().setTitle('🤔 I choose...').setDescription(`**${picked}**`)] });
    },
  },
  {
    name: 'rate',
    category: CATEGORY,
    description: 'Rate anything out of 10. Usage: rate <thing>',
    async execute(message, args) {
      const thing = args.join(' ');
      if (!thing) return message.reply('Usage: `rate <thing>`');
      // Hash the input so the same thing always gets the same rating.
      let hash = 0;
      for (const char of thing.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
      const score = hash % 11;
      return message.channel.send({
        embeds: [baseEmbed().setDescription(`I rate **${thing}** a **${score}/10**.`)],
      });
    },
  },
  {
    name: 'ship',
    category: CATEGORY,
    description: 'Ship two people. Usage: ship @user1 @user2',
    async execute(message, args) {
      const first = (await resolveUser(message, args[0])) ?? message.author;
      const mentioned = [...message.mentions.users.values()];
      const second = mentioned[1] ?? (await resolveUser(message, args[1])) ?? message.author;

      if (first.id === second.id) return message.reply('Usage: `ship @user1 @user2` — name two different people.');

      // Same pair always gets the same score, whichever order they are given in.
      const key = [first.id, second.id].sort().join('-');
      let hash = 0;
      for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
      const score = hash % 101;

      const filled = Math.round(score / 10);
      const bar = `${'💗'.repeat(filled)}${'🖤'.repeat(10 - filled)}`;
      const name = `${first.username.slice(0, Math.ceil(first.username.length / 2))}${second.username.slice(Math.floor(second.username.length / 2))}`;

      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.primary)
            .setTitle('💘 Ship')
            .setDescription(`**${first.username}** 💕 **${second.username}**\n\n${bar}\n**${score}%** — *${name}*`),
        ],
      });
    },
  },
];
