const { baseEmbed } = require('../utils/embeds');

const CATEGORY = 'Text';

const EMOJI_MAP = {
  ' ': '   ',
  '0': ':zero:',
  '1': ':one:',
  '2': ':two:',
  '3': ':three:',
  '4': ':four:',
  '5': ':five:',
  '6': ':six:',
  '7': ':seven:',
  '8': ':eight:',
  '9': ':nine:',
  '!': ':exclamation:',
  '?': ':question:',
  '#': ':hash:',
  '*': ':asterisk:',
};

// A compact 3-row block font. Kept deliberately small so a short word still
// fits inside Discord's 2000 character message limit once it is drawn.
const FONT = {
  A: ['█▀▀█', '█▀▀█', '▀  ▀'],
  B: ['█▀▀▄', '█▀▀▄', '▀▀▀ '],
  C: ['█▀▀', '█  ', '▀▀▀'],
  D: ['█▀▀▄', '█  █', '▀▀▀ '],
  E: ['█▀▀', '█▀▀', '▀▀▀'],
  F: ['█▀▀', '█▀▀', '▀  '],
  G: ['█▀▀▄', '█ ▀█', '▀▀▀ '],
  H: ['█  █', '█▀▀█', '▀  ▀'],
  I: ['█', '█', '▀'],
  J: ['  █', '  █', '▀▀ '],
  K: ['█ █', '█▀▄', '▀ ▀'],
  L: ['█  ', '█  ', '▀▀▀'],
  M: ['█▀▄▀█', '█ ▀ █', '▀   ▀'],
  N: ['█▀▄', '█ █', '▀ ▀'],
  O: ['█▀▀█', '█  █', '▀▀▀▀'],
  P: ['█▀▀█', '█▀▀▀', '▀   '],
  Q: ['█▀▀█', '█  █', '▀▀▀▄'],
  R: ['█▀▀█', '█▀▄ ', '▀ ▀▀'],
  S: ['█▀▀', '▀▀█', '▀▀▀'],
  T: ['▀█▀', ' █ ', ' ▀ '],
  U: ['█  █', '█  █', '▀▀▀▀'],
  V: ['█   █', '▀▄ ▄▀', ' ▀▀ '],
  W: ['█   █', '█ █ █', '▀▀▀▀▀'],
  X: ['█▄ ▄█', ' ▀█▀ ', '▄█▀█▄'],
  Y: ['█ █', '▀█▀', ' ▀ '],
  Z: ['▀▀█', '▄▀ ', '▀▀▀'],
  '0': ['█▀▀█', '█  █', '▀▀▀▀'],
  '1': ['▀█', ' █', '▀▀'],
  '2': ['▀▀█', '▄▀ ', '▀▀▀'],
  '3': ['▀▀█', ' ▀█', '▀▀▀'],
  '4': ['█ █', '▀▀█', '  ▀'],
  '5': ['█▀▀', '▀▀█', '▀▀▀'],
  '6': ['█▀▀', '█▀█', '▀▀▀'],
  '7': ['▀▀█', '  █', '  ▀'],
  '8': ['█▀█', '█▀█', '▀▀▀'],
  '9': ['█▀█', '▀▀█', '▀▀▀'],
  '?': ['▀▀█', ' ▀ ', ' ▀ '],
  '!': ['█', '█', '▀'],
  ' ': ['  ', '  ', '  '],
};

function toAscii(input) {
  const chars = [...input.toUpperCase()].filter((c) => FONT[c]);
  if (chars.length === 0) return null;

  const rows = ['', '', ''];
  for (const char of chars) {
    const glyph = FONT[char];
    for (let i = 0; i < 3; i += 1) rows[i] += `${glyph[i]} `;
  }
  return rows.join('\n');
}

module.exports = [
  {
    name: 'emojify',
    category: CATEGORY,
    description: 'Turn text into letter emojis. Usage: emojify <text>',
    async execute(message, args) {
      const input = args.join(' ');
      if (!input) return message.reply('Usage: `emojify <text>`');

      const output = [...input.toLowerCase()]
        .map((char) => {
          if (EMOJI_MAP[char]) return EMOJI_MAP[char];
          if (/[a-z]/.test(char)) return `:regional_indicator_${char}:`;
          return char;
        })
        .join(' ');

      if (output.length > 2000) return message.reply('That is too long once emojified — try something shorter.');
      return message.channel.send(output);
    },
  },
  {
    name: 'reverse',
    category: CATEGORY,
    description: 'Reverse your text. Usage: reverse <text>',
    async execute(message, args) {
      const input = args.join(' ');
      if (!input) return message.reply('Usage: `reverse <text>`');
      // Split by code point so emoji and accents survive the reversal.
      return message.channel.send([...input].reverse().join('').slice(0, 2000));
    },
  },
  {
    name: 'ascii',
    category: CATEGORY,
    description: 'Turn text into big ASCII letters. Usage: ascii <text>',
    async execute(message, args) {
      const input = args.join(' ');
      if (!input) return message.reply('Usage: `ascii <text>`');
      if (input.length > 12) return message.reply('Keep it to 12 characters or fewer so it fits.');

      const art = toAscii(input);
      if (!art) return message.reply('I can only do letters, numbers, spaces, `?` and `!`.');
      return message.channel.send(`\`\`\`\n${art}\n\`\`\``);
    },
  },
  {
    name: 'mock',
    category: CATEGORY,
    description: 'mOcK sOmEoNe. Usage: mock <text>',
    async execute(message, args) {
      const input = args.join(' ');
      if (!input) return message.reply('Usage: `mock <text>`');
      const output = [...input].map((char, index) => (index % 2 === 0 ? char.toLowerCase() : char.toUpperCase())).join('');
      return message.channel.send(output.slice(0, 2000));
    },
  },
  {
    name: 'clap',
    category: CATEGORY,
    description: 'Put 👏 between 👏 every 👏 word. Usage: clap <text>',
    async execute(message, args) {
      const input = args.join(' ');
      if (!input) return message.reply('Usage: `clap <text>`');
      const output = input.split(/\s+/).filter(Boolean).join(' 👏 ');
      return message.channel.send(output.slice(0, 2000));
    },
  },
];
