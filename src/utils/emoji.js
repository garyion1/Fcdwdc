function parseEmoji(input) {
  const trimmed = input.trim();
  const customMatch = /^<a?:(\w+):(\d+)>$/.exec(trimmed);
  if (customMatch) {
    return { key: customMatch[2], reactable: `${customMatch[1]}:${customMatch[2]}` };
  }
  return { key: trimmed, reactable: trimmed };
}

module.exports = { parseEmoji };
