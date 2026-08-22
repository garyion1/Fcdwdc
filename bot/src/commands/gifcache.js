const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { requireAdminGuild } = require('./license');
const { poolSizes, warmAllPools, TARGET_POOL_SIZE } = require('../utils/gifCache');
const { baseEmbed, COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gifcache')
    .setDescription('Check or refresh the preloaded gif/image pool (admin server only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('status').setDescription('Show how many gifs/images are cached per category.'))
    .addSubcommand((sub) => sub.setName('refresh').setDescription('Refresh every category in the background now, instead of waiting for the daily refresh.')),

  async execute(interaction) {
    const blocked = requireAdminGuild(interaction);
    if (blocked) return interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const sizes = poolSizes();
      const lines = sizes.map(({ category, size }) => `\`${category}\` — ${size}/${TARGET_POOL_SIZE}`);
      const empty = sizes.filter((s) => s.size === 0).length;

      return interaction.reply({
        embeds: [
          baseEmbed(empty > 0 ? COLORS.warning : COLORS.success)
            .setTitle('🎞️ Gif cache')
            .setDescription(lines.join('\n').slice(0, 4000))
            .setFooter({ text: empty > 0 ? `${empty} categor${empty === 1 ? 'y is' : 'ies are'} still empty — run refresh, or wait for the daily one.` : 'All categories have at least some cached.' }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'refresh') {
      warmAllPools().catch((error) => console.error('Gif cache manual refresh error:', error));
      return interaction.reply({
        embeds: [baseEmbed(COLORS.success).setDescription('Refreshing every category in the background — check `/gifcache status` again in a minute or two.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
