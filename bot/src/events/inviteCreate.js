const { isBotUsable } = require('../utils/premium');
const { logEvent } = require('../utils/eventLog');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    if (!invite.guild || !isBotUsable(invite.guild.id)) return;
    await logEvent(invite.guild, 'invites', `🔗 Invite \`${invite.code}\` was created by **${invite.inviter?.tag ?? 'unknown'}**.`);
  },
};
