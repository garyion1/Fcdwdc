const { isBotUsable } = require('../utils/premium');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    if (!isBotUsable(role.guild.id)) return;
    await logEvent(role.guild, 'roles', `➕ Role **${role.name}** was created.`);
  },
};
