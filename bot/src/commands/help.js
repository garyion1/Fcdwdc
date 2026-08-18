const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List Boat Bot commands and get help.'),

  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle('Boat Bot — Commands')
      .setDescription('A powerful Discord bot built for easy server management.')
      .addFields(
        { name: '/help', value: 'List available commands and get help.' },
        { name: '/setup', value: 'Run the guided initial setup.' },
        { name: '/config', value: 'View and edit server configuration.' },
        { name: '/stats', value: 'View server statistics.' },
        { name: '/tickets', value: 'Manage the ticket system.' },
        { name: '/moderation', value: 'Access moderation tools.' },
        { name: '/settings', value: 'Manage bot settings.' },
        { name: '/support', value: 'Get help from the support team.' },
        { name: '/customcommand', value: 'Create custom text commands.' },
        { name: '/embed', value: 'Build and send a custom embed.' },
        { name: '/reactionrole', value: 'Set up reaction roles.' },
        { name: '/giveaway', value: 'Start and manage giveaways.' },
      )
      .setFooter({ text: 'Boat Bot' });

    await interaction.reply({ embeds: [embed] });
  },
};
