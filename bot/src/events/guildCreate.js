const { ChannelType, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { getAdminGuildId, setAdminGuildId, hasActiveLicenseForUser } = require('../utils/licenses');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');

// How long a newly-invited server gets to redeem a license before the bot
// leaves on its own if the inviter still doesn't hold one.
const INVITER_GRACE_PERIOD_MS = 15 * 60 * 1000;

async function enforceInviterLicense(guild) {
  const config = getConfig(guild.id);
  const inviterId = config.invitedBy;
  if (!inviterId) return;
  if (hasActiveLicenseForUser(inviterId)) return;
  console.log(`Leaving "${guild.name}" (${guild.id}) — the member who invited Boat Bot does not hold an active license.`);
  await guild.leave().catch(() => {});
}

module.exports = {
  name: 'guildCreate',
  INVITER_GRACE_PERIOD_MS,
  enforceInviterLicense,
  async execute(guild) {
    if (!getAdminGuildId()) {
      setAdminGuildId(guild.id);
      console.log(`No admin server was set — designated "${guild.name}" (${guild.id}) as the license admin server.`);

      const channel =
        (guild.systemChannel?.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages) ? guild.systemChannel : null) ??
        guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages),
        );
      if (channel) {
        await channel
          .send({
            embeds: [
              baseEmbed(COLORS.primary)
                .setTitle('👑 This is now the Boat Bot admin server')
                .setDescription(
                  'Because this was the first server Boat Bot joined, it has been set as the **admin/control server** for licensing.\n\n' +
                    'From here, server admins can generate and manage license keys with `/license generate`, `/license list`, `/license info`, ' +
                    'and `/license revoke`.\n\n' +
                    'Any server (including this one) activates premium with `/redeem <key>`, and can check its status with `/premium`.\n\n' +
                    'If this server was added by mistake, the bot owner can move admin control with `/adminserver set` in the correct server.',
                ),
            ],
          })
          .catch(() => {});
      }
      return;
    }

    // The admin/control server is the operator's own — never subject to the
    // "inviter needs a license" rule below.
    if (guild.id === getAdminGuildId()) return;

    // Figure out who invited the bot, so we can require they personally hold
    // a license and leave automatically if they later leave the server.
    let inviterId = null;
    try {
      // Give Discord a moment to actually record the audit log entry.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
      const entry = logs.entries.find((e) => e.target?.id === guild.client.user.id);
      inviterId = entry?.executor?.id ?? null;
    } catch (error) {
      console.warn(
        `Could not read the audit log for "${guild.name}" (${guild.id}) — skipping the inviter license check there. Grant "View Audit Log" to enable it.`,
      );
    }

    if (!inviterId) return;

    const config = getConfig(guild.id);
    config.invitedBy = inviterId;
    saveConfig(guild.id);

    const inviter = await guild.client.users.fetch(inviterId).catch(() => null);
    if (inviter) {
      await inviter
        .send({
          embeds: [
            baseEmbed(COLORS.warning)
              .setTitle('⏳ Redeem a license within 15 minutes')
              .setDescription(
                `Thanks for adding Boat Bot to **${guild.name}**! Run \`/redeem <key>\` there within the next 15 minutes, ` +
                  "or the bot will leave automatically. Don't have a key yet? Contact the bot operator to get one.",
              ),
          ],
        })
        .catch(() => {});
    }

    setTimeout(() => {
      enforceInviterLicense(guild).catch((error) => console.error('Inviter license check error:', error));
    }, INVITER_GRACE_PERIOD_MS);
  },
};
