const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listLicensesForUser } = require('../utils/licenses');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('mylicense').setDescription('Check which Boat Bot licenses you personally hold.'),

  async execute(interaction) {
    const licenses = listLicensesForUser(interaction.user.id);

    if (licenses.length === 0) {
      return interaction.reply({
        content: "You don't hold any Boat Bot licenses. Get a key from the bot operator and activate it with `/redeem <key>` in your server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const now = Date.now();
    const lines = licenses.map((l) => {
      const status = !l.expiresAt ? 'Lifetime' : l.expiresAt > now ? `Expires <t:${Math.floor(l.expiresAt / 1000)}:R>` : '**Expired**';
      const server = l.guildId ? ` — server \`${l.guildId}\`` : '';
      return `\`${l.key}\` — ${l.tier} — ${status}${server}`;
    });

    return interaction.reply({
      embeds: [baseEmbed(COLORS.primary).setTitle('🔑 Your licenses').setDescription(lines.join('\n').slice(0, 4000))],
      flags: MessageFlags.Ephemeral,
    });
  },
};
