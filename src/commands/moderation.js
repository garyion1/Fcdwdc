const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuild } = require('../database');
const { logAction } = require('../utils/logger');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Access moderation tools')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Kick a member')
        .addUserOption((opt) => opt.setName('member').setDescription('Member to kick').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the kick')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a member')
        .addUserOption((opt) => opt.setName('member').setDescription('Member to ban').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the ban')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Timeout (mute) a member')
        .addUserOption((opt) => opt.setName('member').setDescription('Member to timeout').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('minutes').setDescription('Timeout duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
        )
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the timeout')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption((opt) => opt.setName('member').setDescription('Member to warn').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the warning').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName('warnings').setDescription("List a member's warnings").addUserOption((opt) => opt.setName('member').setDescription('Member to check').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clearwarnings')
        .setDescription("Clear a member's warnings")
        .addUserOption((opt) => opt.setName('member').setDescription('Member to clear').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (sub === 'kick') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: 'You need the Kick Members permission.', ephemeral: true });
      }
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member || !member.kickable) return interaction.reply({ content: 'I cannot kick that member.', ephemeral: true });
      await member.kick(reason);
      await logAction(guild, { title: 'Member kicked', description: `${target.tag} was kicked by ${interaction.user.tag}\nReason: ${reason}`, color: 0xed4245 });
      return interaction.reply({ content: `${target.tag} has been kicked. Reason: ${reason}` });
    }

    if (sub === 'ban') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: 'You need the Ban Members permission.', ephemeral: true });
      }
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member && !member.bannable) return interaction.reply({ content: 'I cannot ban that member.', ephemeral: true });
      await guild.members.ban(target.id, { reason });
      await logAction(guild, { title: 'Member banned', description: `${target.tag} was banned by ${interaction.user.tag}\nReason: ${reason}`, color: 0xed4245 });
      return interaction.reply({ content: `${target.tag} has been banned. Reason: ${reason}` });
    }

    if (sub === 'timeout') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: 'You need the Timeout Members permission.', ephemeral: true });
      }
      const minutes = interaction.options.getInteger('minutes');
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member || !member.moderatable) return interaction.reply({ content: 'I cannot timeout that member.', ephemeral: true });
      await member.timeout(minutes * 60 * 1000, reason);
      await logAction(guild, {
        title: 'Member timed out',
        description: `${target.tag} was timed out for ${minutes}m by ${interaction.user.tag}\nReason: ${reason}`,
        color: 0xfaa61a,
      });
      return interaction.reply({ content: `${target.tag} has been timed out for ${minutes} minute(s). Reason: ${reason}` });
    }

    if (sub === 'warn') {
      updateGuild(guild.id, (s) => {
        if (!s.warnings[target.id]) s.warnings[target.id] = [];
        s.warnings[target.id].push({ reason, moderatorId: interaction.user.id, timestamp: Date.now() });
      });
      await logAction(guild, { title: 'Member warned', description: `${target.tag} was warned by ${interaction.user.tag}\nReason: ${reason}`, color: 0xfaa61a });
      return interaction.reply({ content: `${target.tag} has been warned. Reason: ${reason}` });
    }

    if (sub === 'warnings') {
      const settings = getGuild(guild.id);
      const warnings = settings.warnings[target.id] ?? [];
      if (warnings.length === 0) return interaction.reply({ content: `${target.tag} has no warnings.`, ephemeral: true });
      const embed = baseEmbed()
        .setTitle(`Warnings for ${target.tag}`)
        .setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} -- <@${w.moderatorId}> on <t:${Math.floor(w.timestamp / 1000)}:d>`).join('\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clearwarnings') {
      updateGuild(guild.id, (s) => (s.warnings[target.id] = []));
      return interaction.reply({ content: `Warnings cleared for ${target.tag}.`, ephemeral: true });
    }
  },
};
