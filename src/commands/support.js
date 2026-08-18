const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('support').setDescription('Get help from the support team'),
  async execute(interaction) {
    const embed = baseEmbed()
      .setTitle('Boat Bot support')
      .setDescription('Need a hand? We can help with:')
      .addFields(
        { name: 'Setup help', value: 'Run `/setup` or ask us to walk you through it.' },
        { name: 'Bug reports', value: 'Tell us what happened and we will look into it.' },
        { name: 'Feature requests', value: "Let us know what you'd like to see added." },
        { name: 'Customer support', value: 'Purchase and account questions.' },
      )
      .setFooter({ text: 'We aim to respond quickly.' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
