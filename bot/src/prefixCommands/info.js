const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');

module.exports = [
  {
    name: 'commands',
    aliases: ['cmds', 'prefixhelp', 'help'],
    category: 'Info',
    description: 'List all prefix commands, or explain one. Usage: help [command]',
    async execute(message, args, config, client) {
      const query = args[0]?.toLowerCase();
      if (query && isBotUsable(message.guild.id)) {
        const resolved = client.prefixCommands.has(query) ? query : config.aliases[query];
        const command = resolved ? client.prefixCommands.get(resolved) : null;

        if (command) {
          const prefix = config.prefixes[0];
          const embed = baseEmbed()
            .setTitle(`${prefix}${command.name}`)
            .setDescription(command.description ?? 'No description available.')
            .addFields({ name: 'Category', value: command.category ?? 'Other', inline: true });

          if (command.aliases?.length) {
            embed.addFields({ name: 'Aliases', value: command.aliases.map((a) => `\`${prefix}${a}\``).join(', '), inline: true });
          }
          if (command.permissions?.length) {
            embed.addFields({ name: 'Requires', value: 'Server permissions (or a role granted them via `fakepermissions`)' });
          }
          return message.channel.send({ embeds: [embed] });
        }

        const custom = config.customCommands[query];
        if (custom) {
          return message.channel.send({
            embeds: [baseEmbed().setTitle(`${config.prefixes[0]}${query}`).setDescription('Custom command.').addFields({ name: 'Responds with', value: custom.slice(0, 1024) })],
          });
        }

        return message.reply(`\`${query}\` is not a command. Run \`${config.prefixes[0]}help\` for the full list.`);
      }

      if (!isBotUsable(message.guild.id)) {
        const embed = baseEmbed(COLORS.warning)
          .setTitle('Boat Bot — Premium required')
          .setDescription(
            'This server does not have an active license, so commands are locked and the full command list is hidden.\n\n' +
              'Run `/redeem <key>` to activate premium, or `/premium` to check status.',
          );
        return message.channel.send({ embeds: [embed] });
      }

      const grouped = new Map();
      for (const command of client.prefixCommandList) {
        const category = command.category ?? 'Other';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(command.name);
      }

      const embed = baseEmbed()
        .setTitle('Prefix Commands')
        .setDescription(`Prefixes: ${config.prefixes.map((p) => `\`${p}\``).join(', ')}`);

      for (const [category, names] of grouped) {
        embed.addFields({ name: category, value: names.map((n) => `\`${n}\``).join(', ') });
      }

      const customNames = Object.keys(config.customCommands);
      embed.addFields({ name: 'Custom commands', value: customNames.length ? customNames.map((n) => `\`${n}\``).join(', ') : 'None' });

      return message.channel.send({ embeds: [embed] });
    },
  },
];
