const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('List available commands and get help'),
  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle('Boat Bot -- Commands')
      .setDescription('Here is everything I can help you with.')
      .addFields(
        { name: '/setup', value: 'Run the guided initial setup (Administrator only)' },
        { name: '/config', value: 'View and edit server configuration' },
        { name: '/stats', value: 'View server statistics' },
        { name: '/tickets', value: 'Manage the ticket system' },
        { name: '/moderation', value: 'Access moderation tools' },
        { name: '/settings', value: 'Manage bot settings (automod, custom commands, logging)' },
        { name: '/giveaway', value: 'Start and manage giveaways' },
        { name: '/embed', value: 'Send a custom embed to a channel' },
        { name: '/reactionrole', value: 'Set up reaction roles' },
        { name: '/support', value: 'Get help from the support team' },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
