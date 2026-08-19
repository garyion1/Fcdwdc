const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { jailMember } = require('../utils/jail');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail a member — they can only see the jail channel, nothing else.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to jail').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for jailing')),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
    if (!member.manageable) {
      return interaction.reply({ content: 'I cannot jail that member (check role hierarchy).', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    const result = await jailMember(interaction.guild, member, interaction.user, reason);
    if (result.alreadyJailed) return interaction.editReply(`**${user.tag}** is already jailed.`);
    if (result.hierarchyError) return interaction.editReply('I cannot jail that member (check role hierarchy).');

    return interaction.editReply({
      embeds: [
        baseEmbed(COLORS.danger).setDescription(
          `🔒 **${user.tag}** has been jailed.\nReason: ${reason}\nThey can now only see ${result.channel}.`,
        ),
      ],
    });
  },
};
