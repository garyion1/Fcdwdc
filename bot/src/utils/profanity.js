const { getConfig } = require('../config/database');

// A modest baseline of common profanity. Deliberately not exhaustive — slurs and
// anything else a specific community wants blocked belong in each server's own
// list via /settings bannedwords, which this filter also checks.
const DEFAULT_BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'piss', 'cunt', 'slut', 'whore'];

function escapeRegex(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsBadWord(text, guildId) {
  if (!text) return false;
  const config = getConfig(guildId);
  const words = [...DEFAULT_BAD_WORDS, ...(config.automod.bannedWords ?? [])];
  if (words.length === 0) return false;
  const pattern = new RegExp(`\\b(${words.map(escapeRegex).join('|')})\\b`, 'i');
  return pattern.test(text);
}

module.exports = { containsBadWord, DEFAULT_BAD_WORDS };
