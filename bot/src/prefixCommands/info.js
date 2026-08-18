const { baseEmbed } = require('../utils/embeds');

module.exports = [
  {
    name: 'commands',
    aliases: ['cmds', 'prefixhelp'],
    category: 'Info',
    description: 'List all prefix commands.',
    async execute(message, args, config, client) {
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
