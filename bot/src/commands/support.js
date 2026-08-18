const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get help from the Boat Bot support team.'),

  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle('Boat Bot Support')
      .setDescription(
        [
          'Need a hand? Here is how to get support:',
          '',
          '• **Setup help** — use `/setup` and `/settings`, or ask in the support server.',
          '• **Bug reports** — describe what happened and the steps to reproduce it.',
          '• **Feature requests** — tell us what you would like to see added.',
          '• Open a ticket with `/tickets panel` if this server has the ticket system enabled.',
        ].join('\n'),
      );

    await interaction.reply({ embeds: [embed] });
  },
};
