const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getGuild, updateGuild } = require('../database');

function parseDuration(input) {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[match[2]];
}

async function endGiveaway(client, guildId, messageId) {
  const settings = getGuild(guildId);
  const giveaway = settings.giveaways[messageId];
  if (!giveaway || giveaway.ended) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  const channel = guild?.channels.cache.get(giveaway.channelId);
  const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;

  const pool = [...(giveaway.entrants ?? [])];
  const winners = [];
  for (let i = 0; i < giveaway.winners && pool.length > 0; i++) {
    winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  updateGuild(guildId, (s) => (s.giveaways[messageId].ended = true));

  if (channel) {
    const resultEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Giveaway ended: ${giveaway.prize}`)
      .setDescription(winners.length > 0 ? `Congratulations ${winners.map((id) => `<@${id}>`).join(', ')}!` : 'No valid entries -- no winner could be picked.');
    await channel.send({ embeds: [resultEmbed] });
    if (message && message.embeds[0]) {
      const endedEmbed = EmbedBuilder.from(message.embeds[0]).setDescription('This giveaway has ended.');
      await message.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
    }
  }
}

module.exports = {
  parseDuration,
  endGiveaway,
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start and manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a giveaway')
        .addStringOption((opt) => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption((opt) => opt.setName('duration').setDescription('e.g. 30s, 10m, 1h, 2d').setRequired(true))
        .addIntegerOption((opt) => opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((sub) =>
      sub.setName('end').setDescription('End a giveaway early').addStringOption((opt) => opt.setName('message-id').setDescription('Giveaway message ID').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationInput = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') ?? 1;
      const durationMs = parseDuration(durationInput);
      if (!durationMs) return interaction.reply({ content: 'Invalid duration. Use a format like 30s, 10m, 1h, or 2d.', ephemeral: true });

      const endsAt = Date.now() + durationMs;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Giveaway: ${prize}`)
        .setDescription(`Click the button below to enter!\nEnds: <t:${Math.floor(endsAt / 1000)}:R>\nWinners: ${winners}`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway-enter').setLabel('Enter giveaway').setStyle(ButtonStyle.Primary).setEmoji('🎉'),
      );

      const message = await interaction.channel.send({ embeds: [embed], components: [row] });

      updateGuild(guildId, (s) => {
        s.giveaways[message.id] = { channelId: interaction.channel.id, prize, winners, endsAt, entrants: [], ended: false };
      });

      setTimeout(() => endGiveaway(interaction.client, guildId, message.id), durationMs);
      return interaction.reply({ content: 'Giveaway started!', ephemeral: true });
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message-id');
      await endGiveaway(interaction.client, guildId, messageId);
      return interaction.reply({ content: 'Giveaway ended.', ephemeral: true });
    }
  },
};
