const { getGuild } = require('../database');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (!reaction.message.guild) return;

    const settings = getGuild(reaction.message.guild.id);
    const match = settings.reactionRoles.find(
      (rr) => rr.messageId === reaction.message.id && rr.emoji === (reaction.emoji.id ?? reaction.emoji.name),
    );
    if (!match) return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (member) await member.roles.remove(match.roleId).catch(() => {});
  },
};
