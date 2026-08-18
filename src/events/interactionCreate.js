const { getGuild, updateGuild } = require('../database');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const payload = { content: 'Something went wrong while running that command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'ticket-close') {
        await interaction.reply('Closing this ticket in 5 seconds...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        return;
      }

      if (interaction.customId === 'giveaway-enter') {
        const settings = getGuild(interaction.guild.id);
        const giveaway = settings.giveaways[interaction.message.id];
        if (!giveaway || giveaway.ended) {
          return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
        }
        if (giveaway.entrants.includes(interaction.user.id)) {
          return interaction.reply({ content: "You're already entered!", ephemeral: true });
        }
        updateGuild(interaction.guild.id, (s) => s.giveaways[interaction.message.id].entrants.push(interaction.user.id));
        return interaction.reply({ content: "You're entered! Good luck.", ephemeral: true });
      }
    }
  },
};
