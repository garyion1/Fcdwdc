const fs = require('fs');
const path = require('path');

module.exports = function loadPrefixCommands(client) {
  client.prefixCommands = new Map();
  client.prefixCommandList = [];

  const dir = path.join(__dirname, '..', 'prefixCommands');
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const exported = require(path.join(dir, file));
    const commands = Array.isArray(exported) ? exported : [exported];

    for (const command of commands) {
      if (!command?.name || !command?.execute) {
        console.warn(`[WARN] Prefix command in "${file}" is missing "name" or "execute" and was skipped.`);
        continue;
      }
      client.prefixCommands.set(command.name, command);
      for (const alias of command.aliases ?? []) client.prefixCommands.set(alias, command);
      client.prefixCommandList.push(command);
    }
  }

  console.log(`Loaded ${client.prefixCommandList.length} prefix commands (${client.prefixCommands.size} with aliases).`);
};
