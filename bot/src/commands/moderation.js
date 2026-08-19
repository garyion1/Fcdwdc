const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { logAction } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Access moderation tools.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Kick a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the kick')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Timeout a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the timeout')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('Warn a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('warnings')
        .setDescription("View a member's warnings.")
        .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Bulk delete messages in this channel.')
        .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'ban') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) {
        return interaction.reply({ content: 'I cannot ban that member (check role hierarchy).' });
      }
      await guild.members.ban(user.id, { reason });
      await logAction(guild, `🔨 **${user.tag}** was banned by ${interaction.user.tag}\nReason: ${reason}`);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been banned.\nReason: ${reason}`)] });
    }

    if (sub === 'kick') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'That user is not in this server.' });
      if (!member.kickable) return interaction.reply({ content: 'I cannot kick that member (check role hierarchy).' });
      await member.kick(reason);
      await logAction(guild, `👢 **${user.tag}** was kicked by ${interaction.user.tag}\nReason: ${reason}`);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been kicked.\nReason: ${reason}`)] });
    }

    if (sub === 'timeout') {
      const user = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'That user is not in this server.' });
      if (!member.moderatable) return interaction.reply({ content: 'I cannot timeout that member (check role hierarchy).' });
      await member.timeout(minutes * 60 * 1000, reason);
      await logAction(guild, `⏱️ **${user.tag}** was timed out for ${minutes}m by ${interaction.user.tag}\nReason: ${reason}`);
      return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** has been timed out for ${minutes} minute(s).\nReason: ${reason}`)] });
    }

    if (sub === 'warn') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const config = getConfig(guild.id);
      if (!config.warnings[user.id]) config.warnings[user.id] = [];
      config.warnings[user.id].push({ reason, moderator: interaction.user.id, timestamp: Date.now() });
      saveConfig(guild.id);
      await logAction(guild, `⚠️ **${user.tag}** was warned by ${interaction.user.tag}\nReason: ${reason}`);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.warning).setDescription(`**${user.tag}** has been warned.\nReason: ${reason}\nTotal warnings: ${config.warnings[user.id].length}`)],
      });
    }

    if (sub === 'warnings') {
      const user = interaction.options.getUser('user', true);
      const config = getConfig(guild.id);
      const warnings = config.warnings[user.id] ?? [];
      if (warnings.length === 0) {
        return interaction.reply({ embeds: [baseEmbed().setDescription(`**${user.tag}** has no warnings.`)] });
      }
      const list = warnings.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.timestamp / 1000)}:R>`).join('\n');
      return interaction.reply({
        embeds: [baseEmbed(COLORS.warning).setTitle(`Warnings for ${user.tag}`).setDescription(list)]
      });
    }

    if (sub === 'clear') {
      const amount = interaction.options.getInteger('amount', true);
      await interaction.deferReply();
      const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
      if (!deleted) {
        return interaction.editReply('Failed to delete messages (they may be older than 14 days).');
      }
      await logAction(guild, `🧹 ${interaction.user.tag} cleared ${deleted.size} messages in ${interaction.channel}`);
      return interaction.editReply(`Deleted ${deleted.size} message(s).`);
    }
  },
};
