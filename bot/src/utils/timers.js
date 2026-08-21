const { getConfig, saveConfig } = require('../config/database');

const timerHandles = new Map();

function stopTimer(guildId, channelId) {
  const key = `${guildId}:${channelId}`;
  const handle = timerHandles.get(key);
  if (handle) {
    clearInterval(handle);
    timerHandles.delete(key);
  }
}

function scheduleTimer(client, guildId, channelId, intervalMinutes) {
  stopTimer(guildId, channelId);
  const key = `${guildId}:${channelId}`;

  const handle = setInterval(
    async () => {
      const config = getConfig(guildId);
      const timer = config.timers[channelId];
      if (!timer) {
        stopTimer(guildId, channelId);
        return;
      }
      const channel = client.channels.cache.get(channelId);
      if (!channel) {
        delete config.timers[channelId];
        saveConfig(guildId);
        stopTimer(guildId, channelId);
        return;
      }
      await channel.send(timer.message).catch(() => {});
      timer.lastSent = Date.now();
      saveConfig(guildId);
    },
    Math.max(intervalMinutes, 1) * 60 * 1000,
  );

  timerHandles.set(key, handle);
}

module.exports = { scheduleTimer, stopTimer };
