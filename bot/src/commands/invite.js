const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getAdminServerInvite } = require('../utils/adminInvite');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Get an invite link to the Boat Bot support/admin server.'),

  async execute(interaction) {
    const link = await getAdminServerInvite(interaction.client);
    if (!link) {
      return interaction.reply({ content: 'No support server invite is available right now — try again later.', flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ embeds: [baseEmbed().setDescription(`Join the Boat Bot support server: ${link}`)] });
  },
};
