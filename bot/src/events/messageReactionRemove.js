const { getConfig } = require('../config/database');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }
    if (!reaction.message.guild) return;

    const config = getConfig(reaction.message.guild.id);
    const bindings = config.reactionRoles[reaction.message.id];
    if (!bindings) return;

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    const roleId = bindings[emojiKey] ?? bindings[reaction.emoji.name];
    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (member) await member.roles.remove(roleId).catch(() => {});
  },
};
