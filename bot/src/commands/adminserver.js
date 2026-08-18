const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAdminGuildId, setAdminGuildId } = require('../utils/licenses');
const { isBotOwner } = require('../utils/premium');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminserver')
    .setDescription('Bot owner only: view or move the license admin/control server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('status').setDescription('Show which server is currently the admin/control server.'))
    .addSubcommand((sub) => sub.setName('set').setDescription('Set this server as the admin/control server (bot owner only).')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const adminGuildId = getAdminGuildId();

    if (sub === 'status') {
      return interaction.reply({
        content: adminGuildId
          ? `The current admin/control server ID is \`${adminGuildId}\`${adminGuildId === interaction.guildId ? ' (this server).' : '.'}`
          : 'No admin/control server has been set yet — it will be set automatically the next time the bot joins a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'set') {
      const owner = await isBotOwner(interaction.client, interaction.user.id);
      if (!owner) {
        return interaction.reply({ content: 'Only the bot owner can move the admin/control server.', flags: MessageFlags.Ephemeral });
      }
      setAdminGuildId(interaction.guildId);
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription('This server is now the admin/control server for licensing.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
