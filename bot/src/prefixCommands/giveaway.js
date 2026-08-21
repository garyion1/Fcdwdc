const { PermissionFlagsBits } = require('discord.js');
const { saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { scheduleGiveawayEnd, endGiveaway, pickWinners, parseDuration } = require('../commands/giveaway');

const CATEGORY = 'Giveaways';

module.exports = [
  {
    name: 'giveaway',
    aliases: ['gw'],
    category: CATEGORY,
    description: 'Run a giveaway. Usage: giveaway start <duration> <winners> <prize> | end <messageId> | reroll <messageId> | list',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config, client) {
      const action = args[0]?.toLowerCase();

      if (action === 'start') {
        const durationMs = parseDuration(args[1] ?? '');
        const winnerCount = parseInt(args[2], 10);
        const prize = args.slice(3).join(' ');

        if (!durationMs || !Number.isFinite(winnerCount) || winnerCount < 1 || !prize) {
          return message.reply('Usage: `giveaway start <duration> <winners> <prize>` e.g. `giveaway start 2h 1 Nitro`\nDuration uses s/m/h/d.');
        }

        const endsAt = Date.now() + durationMs;
        const post = await message.channel.send({
          embeds: [
            baseEmbed(COLORS.primary)
              .setTitle('🎉 Giveaway')
              .setDescription(`**Prize:** ${prize}\nReact with 🎉 to enter!\nEnds: <t:${Math.floor(endsAt / 1000)}:R>\nWinners: ${winnerCount}`),
          ],
        });
        await post.react('🎉').catch(() => {});

        config.giveaways[post.id] = { channelId: message.channel.id, prize, endsAt, winnerCount, ended: false };
        saveConfig(message.guild.id);
        scheduleGiveawayEnd(client, message.guild.id, post.id, durationMs);
        return post;
      }

      if (action === 'end') {
        const messageId = args[1]?.trim();
        const giveaway = messageId ? config.giveaways[messageId] : null;
        if (!giveaway || giveaway.ended) return message.reply('No active giveaway found with that message ID.');
        await endGiveaway(client, message.guild.id, messageId);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Giveaway ended.')] });
      }

      if (action === 'reroll') {
        const messageId = args[1]?.trim();
        const giveaway = messageId ? config.giveaways[messageId] : null;
        if (!giveaway || !giveaway.ended) return message.reply('That giveaway has not ended yet, or does not exist.');

        const winners = await pickWinners(client, message.guild.id, { ...giveaway, messageId });
        if (winners.length === 0) return message.reply('There were no valid entries to reroll.');

        const channel = message.guild.channels.cache.get(giveaway.channelId) ?? message.channel;
        await channel.send(`🎉 New winner(s) for **${giveaway.prize}**: ${winners.map((w) => `<@${w}>`).join(', ')}`).catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Giveaway rerolled.')] });
      }

      if (action === 'cancel') {
        const messageId = args[1]?.trim();
        if (!messageId || !config.giveaways[messageId]) return message.reply('Usage: `giveaway cancel <messageId>`');
        delete config.giveaways[messageId];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Giveaway cancelled — no winner will be drawn.')] });
      }

      const entries = Object.entries(config.giveaways ?? {});
      if (entries.length === 0) return message.channel.send('There are no giveaways in this server.');

      const lines = entries.map(([messageId, giveaway]) => {
        const state = giveaway.ended ? 'ended' : `ends <t:${Math.floor(giveaway.endsAt / 1000)}:R>`;
        return `\`${messageId}\` — **${giveaway.prize}** in <#${giveaway.channelId}> (${state})`;
      });
      return message.channel.send({
        embeds: [baseEmbed().setTitle(`🎉 Giveaways (${entries.length})`).setDescription(lines.join('\n').slice(0, 4000))],
      });
    },
  },
];
