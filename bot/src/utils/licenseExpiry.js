const { getAllGuildIds, getConfig, saveConfig } = require('../config/database');
const { getLicense } = require('./licenses');
const { baseEmbed, COLORS } = require('./embeds');

// Warn a redeemer this many ms before their monthly license lapses, and sweep
// on this interval — a license only needs day-scale precision, so an hourly
// check is more than enough and cheap to run against every guild.
const WARNING_MS = 3 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

async function notifyRedeemer(client, licenseKey, guildId, kind, remainingMs) {
  if (!licenseKey) return;
  const license = getLicense(licenseKey);
  if (!license?.redeemedBy) return;

  const user = await client.users.fetch(license.redeemedBy).catch(() => null);
  if (!user) return;

  const guild = client.guilds.cache.get(guildId);
  const guildName = guild?.name ?? 'your server';

  if (kind === 'expiring') {
    const days = Math.max(Math.ceil(remainingMs / (24 * 60 * 60 * 1000)), 1);
    await user
      .send({
        embeds: [
          baseEmbed(COLORS.warning)
            .setTitle('⏳ Your Boat Bot license is expiring soon')
            .setDescription(
              `Your license for **${guildName}** expires in about ${days} day(s). Contact the bot operator for a renewal key and run \`/redeem <key>\` before it lapses.`,
            ),
        ],
      })
      .catch(() => {});
  } else {
    await user
      .send({
        embeds: [
          baseEmbed(COLORS.danger)
            .setTitle('⌛ Your Boat Bot license has expired')
            .setDescription(`Premium for **${guildName}** has been deactivated because your license expired. Run \`/redeem <key>\` with a new key to reactivate it.`),
        ],
      })
      .catch(() => {});
  }
}

async function sweepLicenseExpiry(client) {
  const now = Date.now();

  for (const guildId of getAllGuildIds()) {
    const config = getConfig(guildId);
    const premium = config.premium;
    if (!premium?.active || !premium.expiresAt) continue;

    const remaining = premium.expiresAt - now;

    if (remaining <= 0) {
      premium.active = false;
      saveConfig(guildId);
      await notifyRedeemer(client, premium.licenseKey, guildId, 'expired').catch((error) => console.error('License expiry notice error:', error));
      continue;
    }

    if (remaining <= WARNING_MS && !premium.expiryWarned) {
      premium.expiryWarned = true;
      saveConfig(guildId);
      await notifyRedeemer(client, premium.licenseKey, guildId, 'expiring', remaining).catch((error) => console.error('License warning notice error:', error));
    }
  }
}

function startLicenseExpirySweep(client) {
  sweepLicenseExpiry(client).catch((error) => console.error('License expiry sweep error:', error));
  setInterval(() => {
    sweepLicenseExpiry(client).catch((error) => console.error('License expiry sweep error:', error));
  }, SWEEP_INTERVAL_MS);
}

module.exports = { startLicenseExpirySweep, sweepLicenseExpiry, WARNING_MS };
