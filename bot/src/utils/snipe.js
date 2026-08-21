// In-memory only (per channel) — resets on restart, which is the norm for a snipe feature.
const lastDeleted = new Map();
const lastEdited = new Map();

function recordDeleted(channelId, entry) {
  lastDeleted.set(channelId, entry);
}

function recordEdited(channelId, entry) {
  lastEdited.set(channelId, entry);
}

function getDeleted(channelId) {
  return lastDeleted.get(channelId) ?? null;
}

function getEdited(channelId) {
  return lastEdited.get(channelId) ?? null;
}

module.exports = { recordDeleted, recordEdited, getDeleted, getEdited };
