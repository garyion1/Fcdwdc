const { baseEmbed, COLORS } = require('../utils/embeds');
const { randomCountry, isCorrectAnswer, flagEmoji, flagImageUrl } = require('../utils/countries');

const CATEGORY = 'Fun';

const ROUND_MS = 30000;
const MAX_PRIZE_LENGTH = 200;

// One round per channel. Without this, two rounds in the same channel would
// both be collecting and a single guess could win both.
const activeChannels = new Set();

module.exports = [
  {
    name: 'geography',
    aliases: ['flag', 'guesstheflag'],
    category: CATEGORY,
    description: 'Guess the country from its flag. Usage: geography [prize]',
    async execute(message, args) {
      if (activeChannels.has(message.channel.id)) {
        return message.reply('A round is already running in this channel — finish that one first.');
      }

      const prize = args.join(' ').slice(0, MAX_PRIZE_LENGTH).trim();
      const country = randomCountry();

      activeChannels.add(message.channel.id);

      const question = baseEmbed(COLORS.primary)
        .setTitle('🌍 Guess the flag')
        .setDescription(`Which country is this?\nFirst correct answer wins — you have **${ROUND_MS / 1000} seconds**.`)
        .setImage(flagImageUrl(country.code));
      if (prize) question.addFields({ name: '🎁 Prize', value: prize });

      await message.channel.send({ embeds: [question] }).catch(() => {});

      let collector;
      try {
        collector = message.channel.createMessageCollector({
          filter: (m) => !m.author.bot,
          time: ROUND_MS,
        });
      } catch {
        // No collector available (shouldn't happen on a real text channel).
        activeChannels.delete(message.channel.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.danger).setDescription('I could not start a round in this channel.')] }).catch(() => {});
      }

      let winner = null;

      collector.on('collect', (guess) => {
        if (!isCorrectAnswer(country, guess.content)) return;
        winner = guess.author;
        collector.stop('answered');
      });

      collector.on('end', async () => {
        activeChannels.delete(message.channel.id);

        if (!winner) {
          return message.channel
            .send({
              embeds: [
                baseEmbed(COLORS.warning)
                  .setTitle("⏰ Time's up")
                  .setDescription(`Nobody got it — it was ${flagEmoji(country.code)} **${country.name}**.`),
              ],
            })
            .catch(() => {});
        }

        const win = baseEmbed(COLORS.success)
          .setTitle('🎉 Correct')
          .setDescription(`${winner} got it — ${flagEmoji(country.code)} **${country.name}**.`);
        if (prize) win.addFields({ name: '🎁 Prize', value: `${winner} wins **${prize}**` });

        // The bot can't hand over a prize itself, so the round announces the
        // winner and whoever started it settles up.
        return message.channel.send({ embeds: [win] }).catch(() => {});
      });
    },
  },
];
