const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

function parseDuration(input) {
  const match = /^(\d+)([smhd])$/i.exec(input.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

async function pickWinners(client, guildId, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return [];
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return [];
  const reaction = message.reactions.cache.get('🎉');
  if (!reaction) return [];
  const reactedUsers = await reaction.users.fetch().catch(() => null);
  if (!reactedUsers) return [];
  const pool = [...reactedUsers.filter((u) => !u.bot).values()];

  const winners = [];
  for (let i = 0; i < giveaway.winnerCount && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0].id);
  }
  return winners;
}

async function endGiveaway(client, guildId, messageId) {
  const config = getConfig(guildId);
  const giveaway = config.giveaways[messageId];
  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;
  saveConfig(guildId);

  const winners = await pickWinners(client, guildId, { ...giveaway, messageId });
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;

  if (winners.length === 0) {
    await channel.send(`No valid entries — the giveaway for **${giveaway.prize}** has ended with no winner.`).catch(() => {});
    return;
  }
  await channel.send(`🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.prize}**!`).catch(() => {});
}

function scheduleGiveawayEnd(client, guildId, messageId, delay) {
  setTimeout(() => endGiveaway(client, guildId, messageId).catch((error) => console.error('Giveaway end error:', error)), Math.max(delay, 0));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start and manage giveaways.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a giveaway in this channel.')
        .addStringOption((o) => o.setName('prize').setDescription('What is being given away').setRequired(true))
        .addStringOption((o) => o.setName('duration').setDescription('Duration, e.g. 10m, 1h, 1d').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early.')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the giveaway message').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll the winner(s) of an ended giveaway.')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the giveaway message').setRequired(true)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = getConfig(interaction.guildId);

    if (sub === 'start') {
      const prize = interaction.options.getString('prize', true);
      const durationInput = interaction.options.getString('duration', true);
      const winnerCount = interaction.options.getInteger('winners') ?? 1;
      const durationMs = parseDuration(durationInput);

      if (!durationMs) {
        return interaction.reply({
          content: 'Invalid duration. Use a number followed by s, m, h, or d (e.g. `30m`, `2h`, `1d`).'
        });
      }

      const endsAt = Date.now() + durationMs;
      const embed = baseEmbed(COLORS.primary)
        .setTitle('🎉 Giveaway')
        .setDescription(`**Prize:** ${prize}\nReact with 🎉 to enter!\nEnds: <t:${Math.floor(endsAt / 1000)}:R>\nWinners: ${winnerCount}`);

      await interaction.reply({ embeds: [embed] });
      const message = await interaction.fetchReply();
      await message.react('🎉');

      config.giveaways[message.id] = {
        channelId: interaction.channelId,
        prize,
        endsAt,
        winnerCount,
        ended: false,
      };
      saveConfig(interaction.guildId);

      scheduleGiveawayEnd(interaction.client, interaction.guildId, message.id, durationMs);
      return;
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id', true).trim();
      const giveaway = config.giveaways[messageId];
      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: 'No active giveaway found with that message ID.' });
      }
      await endGiveaway(interaction.client, interaction.guildId, messageId);
      return interaction.reply({ content: 'Giveaway ended.' });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id', true).trim();
      const giveaway = config.giveaways[messageId];
      if (!giveaway || !giveaway.ended) {
        return interaction.reply({ content: 'That giveaway has not ended yet, or does not exist.' });
      }
      const winners = await pickWinners(interaction.client, interaction.guildId, { ...giveaway, messageId });
      const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
      if (channel && winners.length > 0) {
        await channel.send(`🎉 New winner(s) for **${giveaway.prize}**: ${winners.map((w) => `<@${w}>`).join(', ')}`);
      }
      return interaction.reply({ content: 'Giveaway rerolled.' });
    }
  },

  scheduleGiveawayEnd,
};
