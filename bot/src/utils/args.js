async function resolveUser(message, arg) {
  const mention = message.mentions.users.first();
  if (mention) return mention;
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, '');
  if (!/^\d{15,25}$/.test(id)) return null;
  return message.client.users.fetch(id).catch(() => null);
}

module.exports = { resolveUser };
