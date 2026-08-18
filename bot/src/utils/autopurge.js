const MAX_BULK_DELETE_PASSES = 20;

const activeIntervals = new Map();

async function purgeChannel(channel) {
  let totalDeleted = 0;
  try {
    for (let i = 0; i < MAX_BULK_DELETE_PASSES; i++) {
      const deleted = await channel.bulkDelete(100, true);
      totalDeleted += deleted.size;
      if (deleted.size < 100) break;
    }
  } catch (error) {
    console.error(`Autopurge failed in channel ${channel.id}:`, error);
  }
  return totalDeleted;
}

function schedulePurge(client, guildId, channelId, intervalMinutes) {
  stopPurge(channelId);
  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(async () => {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      stopPurge(channelId);
      return;
    }
    await purgeChannel(channel);
  }, intervalMs);
  activeIntervals.set(channelId, timer);
}

function stopPurge(channelId) {
  const timer = activeIntervals.get(channelId);
  if (timer) {
    clearInterval(timer);
    activeIntervals.delete(channelId);
  }
}

module.exports = { purgeChannel, schedulePurge, stopPurge };
