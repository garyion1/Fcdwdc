const { getConfig } = require('../config/database');
const { isBotUsable } = require('../utils/premium');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    if (!isBotUsable(channel.guild.id)) return;
    const config = getConfig(channel.guild.id);
    if (!config.jail.roleId || channel.id === config.jail.channelId) return;

    const role = channel.guild.roles.cache.get(config.jail.roleId);
    if (!role) return;

    await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
  },
};
