const { baseEmbed, COLORS } = require('./embeds');
const { invokeText } = require('./invokeMessages');

// Every punishment tells the member what happened and why. Wording per
// action; a server can replace any of it with `,invoke <command> dm <text>`.
//
// For ban and kick this MUST be sent before the action runs — once the member
// is gone the bot no longer shares a server with them and Discord refuses the
// DM.
const NOTICES = {
  ban: { emoji: '🔨', color: COLORS.danger, line: (guild) => `You have been banned from **${guild}**.` },
  hardban: { emoji: '🔨', color: COLORS.danger, line: (guild) => `You have been banned from **${guild}**.` },
  softban: { emoji: '👢', color: COLORS.danger, line: (guild) => `You have been removed from **${guild}**.` },
  tempban: { emoji: '🔨', color: COLORS.danger, line: (guild) => `You have been temporarily banned from **${guild}**.` },
  kick: { emoji: '👢', color: COLORS.warning, line: (guild) => `You have been kicked from **${guild}**.` },
  warn: { emoji: '⚠️', color: COLORS.warning, line: (guild) => `You have been warned in **${guild}**.` },
  timeout: { emoji: '⏱️', color: COLORS.warning, line: (guild) => `You have been timed out in **${guild}**.` },
  jail: { emoji: '🚔', color: COLORS.warning, line: (guild) => `You have been jailed in **${guild}**.` },
};

// Returns true when the DM actually landed. A member with DMs closed, or who
// blocked the bot, simply cannot be reached — callers surface that rather
// than letting a moderator assume the person was told.
async function notifyPunishedMember(command, { user, guild, config, reason, moderator, duration }) {
  const notice = NOTICES[command];
  if (!notice || !user) return false;

  const ctx = { user, guild, reason, moderator, duration };
  const custom = invokeText(config, command, 'dm', ctx);

  let description = custom;
  if (!description) {
    const parts = [`${notice.emoji} ${notice.line(guild.name)}`];
    if (duration) parts.push(`**Duration:** ${duration}`);
    parts.push(`**Reason:** ${reason || 'No reason provided'}`);
    description = parts.join('\n');
  }

  return user
    .send({ embeds: [baseEmbed(notice.color).setDescription(description)] })
    .then(() => true)
    .catch(() => false);
}

// Appended to a moderator-facing confirmation when the member could not be
// reached, so "did they get told?" is never a guess.
function undeliveredNote(delivered) {
  return delivered ? '' : ' *(couldn\'t DM them — their DMs are closed)*';
}

module.exports = { notifyPunishedMember, undeliveredNote };
