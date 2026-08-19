const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { unjailMember } = require('../utils/jail');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Release a jailed member and restore their previous roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to release').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });

    const result = await unjailMember(interaction.guild, member, interaction.user);
    if (result.notJailed) return interaction.reply({ content: `**${user.tag}** is not jailed.`, flags: MessageFlags.Ephemeral });

    return interaction.reply({ embeds: [baseEmbed(COLORS.success).setDescription(`🔓 **${user.tag}** has been released from jail.`)] });
  },
};
