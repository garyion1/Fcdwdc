const { getConfig } = require('../config/database');

// Common profanity — checked as whole words against the original text.
const DEFAULT_BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'piss', 'cunt', 'slut', 'whore'];

// Slurs and hate speech — the kind of thing that gets a server actioned under
// Discord's hateful-conduct policy. Checked against a normalized form of the text
// (leetspeak collapsed, punctuation/spaces stripped, excessive letter-stretching
// trimmed) so obvious evasions like "n1gger", "n.i.g.g.e.r", or "niiiigger" still
// get caught, not just the exact literal spelling.
const SEVERE_WORDS = ['nigger', 'nigga', 'faggot', 'chink', 'spic', 'kike', 'tranny'];

const LEET_MAP = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '+': 't' };

function escapeRegex(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Collapses runs of 3+ identical letters down to 2 (handles stretching like
// "niiiigger" or "niggerrrr") while leaving genuine double letters — "nigger",
// "asshole" — untouched, so this can't collapse a slur into a shorter unrelated
// word (e.g. it must never turn "nigger" into "niger", which is a country name).
function collapseStretching(str) {
  return str.replace(/([a-z])\1{2,}/g, '$1$1');
}

function normalizeForSevereCheck(text) {
  let out = '';
  for (const ch of text.toLowerCase()) {
    if (ch in LEET_MAP) out += LEET_MAP[ch];
    else if (/[a-z]/.test(ch)) out += ch;
    // anything else — spaces, punctuation, emoji, unmapped digits — is dropped,
    // which is what lets "n-i-g-g-e-r" or "n i g g e r" still get caught below
  }
  return collapseStretching(out);
}

function containsSevereWord(text) {
  if (!text) return false;
  const normalized = normalizeForSevereCheck(text);
  return SEVERE_WORDS.some((word) => normalized.includes(word));
}

function containsBadWord(text, guildId) {
  if (!text) return false;
  if (containsSevereWord(text)) return true;

  const config = getConfig(guildId);
  const words = [...DEFAULT_BAD_WORDS, ...(config.automod.bannedWords ?? [])];
  if (words.length === 0) return false;
  const pattern = new RegExp(`\\b(${words.map(escapeRegex).join('|')})\\b`, 'i');
  return pattern.test(text);
}

module.exports = { containsBadWord, containsSevereWord, DEFAULT_BAD_WORDS, SEVERE_WORDS };
