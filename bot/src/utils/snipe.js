// In-memory only (per channel) — resets on restart, which is the norm for a snipe feature.
const lastDeleted = new Map();
const lastEdited = new Map();

// Nobody snipes a message from hours ago, but the entry would otherwise sit
// in memory for every channel of every guild until restart.
const SNIPE_TTL_MS = 2 * 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SNIPE_TTL_MS;
  for (const store of [lastDeleted, lastEdited]) {
    for (const [channelId, entry] of store) {
      if ((entry?.timestamp ?? 0) < cutoff) store.delete(channelId);
    }
  }
}, 30 * 60 * 1000).unref?.();

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
