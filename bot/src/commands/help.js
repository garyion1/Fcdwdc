const { SlashCommandBuilder } = require('discord.js');
const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List Boat Bot commands and get help.'),

  async execute(interaction) {
    const config = getConfig(interaction.guildId);

    if (!isBotUsable(interaction.guildId)) {
      const embed = baseEmbed(COLORS.warning)
        .setTitle('Boat Bot — Premium required')
        .setDescription(
          'This server does not have an active license, so commands are locked and the full command list is hidden.\n\n' +
            'Run `/redeem <key>` to activate premium, or `/premium` to check status.',
        );
      return interaction.reply({ embeds: [embed] });
    }

    const embed = baseEmbed()
      .setTitle('Boat Bot — Commands')
      .setDescription(
        `A powerful Discord bot built for easy server management.\n` +
          `Text commands also work with any of these prefixes: ${config.prefixes.map((p) => `\`${p}\``).join(', ')} — try \`${config.prefixes[0]}commands\` to see all of them.`,
      )
      .addFields(
        { name: '/help', value: 'List available commands and get help.' },
        { name: '/setup', value: 'Run the guided initial setup.' },
        { name: '/config', value: 'View and edit server configuration.' },
        { name: '/stats', value: 'View server statistics.' },
        { name: '/tickets', value: 'Manage the ticket you are currently in.' },
        { name: '/ticketsetup', value: 'Configure ticket types, panels, and behavior.' },
        { name: '/moderation', value: 'Access moderation tools.' },
        { name: '/lock', value: 'Lock a channel (blocks messages and threads).' },
        { name: '/unlock', value: 'Unlock a channel.' },
        { name: '/autopurge', value: 'Auto-purge a channel on a repeating interval.' },
        { name: '/antiraid', value: 'Configure anti-raid protection.' },
        { name: '/jail', value: 'Jail a member — they can only see the jail channel.' },
        { name: '/unjail', value: 'Release a jailed member.' },
        { name: '/premium', value: "View this server's premium status." },
        { name: '/redeem', value: 'Redeem a license key to activate premium.' },
        { name: '/settings', value: 'Manage bot settings, including prefixes.' },
        { name: '/support', value: 'Get help from the support team.' },
        { name: '/customcommand', value: 'Create custom text commands.' },
        { name: '/embed', value: 'Build and send a custom embed.' },
        { name: '/say', value: 'Make the bot say something.' },
        { name: '/reactionrole', value: 'Set up reaction roles.' },
        { name: '/giveaway', value: 'Start and manage giveaways.' },
      )
      .setFooter({ text: 'Boat Bot' });

    await interaction.reply({ embeds: [embed] });
  },
};
