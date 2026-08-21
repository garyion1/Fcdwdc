const { getConfig, saveConfig } = require('../config/database');

const DISBOARD_BOT_ID = '302050872383242240';
const BUMP_INTERVAL_MS = 2 * 60 * 60 * 1000;

async function sendBumpReminder(client, guildId) {
  const config = getConfig(guildId);
  if (!config.bumpReminder.enabled || !config.bumpReminder.channel) return;

  // Someone bumped again while this reminder was pending — that bump owns the
  // next reminder, so this one has nothing to do.
  if (config.bumpReminder.lastBump && Date.now() - config.bumpReminder.lastBump < BUMP_INTERVAL_MS - 30000) return;

  const channel = client.channels.cache.get(config.bumpReminder.channel);
  if (!channel) return;
  await channel.send(config.bumpReminder.message).catch(() => {});

  if (config.bumpReminder.autoLock) {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null }, { reason: 'Bump reminder — unlocked for bumping' }).catch(() => {});
  }
}

function scheduleBumpReminder(client, guildId, delayMs) {
  setTimeout(
    () => {
      sendBumpReminder(client, guildId).catch((error) => console.error('Bump reminder error:', error));
    },
    Math.max(delayMs, 0),
  );
}

// Disboard posts an embed once a bump lands — that's the cue to start the clock.
async function handleBumpSuccess(message) {
  const config = getConfig(message.guild.id);
  if (!config.bumpReminder.enabled) return;

  const text = `${message.embeds[0]?.description ?? ''} ${message.content}`.toLowerCase();
  if (!text.includes('bump done') && !text.includes('bumped')) return;

  config.bumpReminder.lastBump = Date.now();
  saveConfig(message.guild.id);

  const channel = config.bumpReminder.channel ? message.guild.channels.cache.get(config.bumpReminder.channel) : message.channel;
  await (channel ?? message.channel).send(config.bumpReminder.thankYou).catch(() => {});

  if (config.bumpReminder.autoClean && channel) {
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    const junk = recent?.filter((m) => m.author.bot && m.id !== message.id && Date.now() - m.createdTimestamp < 60 * 60 * 1000);
    if (junk?.size) await channel.bulkDelete(junk, true).catch(() => {});
  }

  scheduleBumpReminder(message.client, message.guild.id, BUMP_INTERVAL_MS);
}

// Rebuild pending reminders after a restart from the stored lastBump timestamp.
function restoreBumpReminders(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = getConfig(guild.id);
    if (!config.bumpReminder.enabled || !config.bumpReminder.channel) continue;

    const elapsed = config.bumpReminder.lastBump ? Date.now() - config.bumpReminder.lastBump : Infinity;
    if (elapsed >= BUMP_INTERVAL_MS) {
      scheduleBumpReminder(client, guild.id, 5000);
    } else {
      scheduleBumpReminder(client, guild.id, BUMP_INTERVAL_MS - elapsed);
    }
  }
}

module.exports = { handleBumpSuccess, sendBumpReminder, scheduleBumpReminder, restoreBumpReminders, DISBOARD_BOT_ID, BUMP_INTERVAL_MS };
