async function resolveUser(message, arg) {
  const mention = message.mentions.users.first();
  if (mention) return mention;
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, '');
  if (!/^\d{15,25}$/.test(id)) return null;
  return message.client.users.fetch(id).catch(() => null);
}

function parseDuration(input) {
  if (!input) return null;
  const match = /^(\d+)\s*(s|m|h|d|w)?$/i.exec(input.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
}

module.exports = { resolveUser, parseDuration };
