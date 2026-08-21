const { AuditLogEvent } = require('discord.js');
const { isBotUsable } = require('../utils/premium');
const { handleAntinukeEvent } = require('../utils/antinuke');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    if (!isBotUsable(role.guild.id)) return;
    await logEvent(role.guild, 'roles', `🗑️ Role **${role.name}** was deleted.`);
    await handleAntinukeEvent(role.guild, 'role', AuditLogEvent.RoleDelete, role.name);
  },
};
