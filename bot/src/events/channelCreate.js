const { getConfig } = require('../config/database');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild) return;
    const config = getConfig(channel.guild.id);
    if (!config.jail.roleId || channel.id === config.jail.channelId) return;

    const role = channel.guild.roles.cache.get(config.jail.roleId);
    if (!role) return;

    await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
  },
};
