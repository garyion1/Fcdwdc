const { getConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { recordJoin, isRaidActive, triggerRaidMode } = require('../utils/antiraid');
const { logAction } = require('../utils/logger');
const { isBotUsable } = require('../utils/premium');
const { handleBotAdd } = require('../utils/antinuke');
const { logEvent } = require('../utils/eventLog');

function formatMessage(template, member) {
  return template
    .replaceAll('{user.name}', member.user.tag)
    .replaceAll('{user}', `${member}`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', `${member.guild.memberCount}`);
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (!isBotUsable(member.guild.id)) return;
    const config = getConfig(member.guild.id);

    await logEvent(member.guild, 'members', `📥 **${member.user.tag}** joined. (${member.guild.memberCount} members)`);

    if (member.user.bot) {
      await handleBotAdd(member).catch((error) => console.error('Antinuke bot-add error:', error));
      return;
    }

    if (config.antiraid?.enabled) {
      const count = recordJoin(member.guild.id, config.antiraid.windowSeconds);
      if (count >= config.antiraid.joinThreshold && !isRaidActive(member.guild.id)) {
        await triggerRaidMode(member.guild, config);
      }
    }

    if (config.antiraid?.minAccountAgeMinutes > 0) {
      const ageMinutes = (Date.now() - member.user.createdTimestamp) / 60000;
      if (ageMinutes < config.antiraid.minAccountAgeMinutes) {
        const reason = `Anti-raid: account younger than ${config.antiraid.minAccountAgeMinutes} minute(s)`;
        if (config.antiraid.action === 'ban' && member.bannable) {
          await member.ban({ reason }).catch(() => {});
        } else if (member.kickable) {
          await member.kick(reason).catch(() => {});
        }
        await logAction(member.guild, `🚨 ${member.user.tag} was removed by anti-raid (account age below threshold)`);
        return;
      }
    }

    if (config.welcomeChannel) {
      const channel = member.guild.channels.cache.get(config.welcomeChannel);
      if (channel) {
        const text = formatMessage(config.welcomeMessage, member);
        await channel
          .send({ embeds: [baseEmbed(COLORS.success).setDescription(text).setThumbnail(member.user.displayAvatarURL())] })
          .catch(() => {});
      }
    }

    // Extra welcome channels added with `,welcome add`.
    for (const [channelId, template] of Object.entries(config.welcomeMessages ?? {})) {
      if (channelId === config.welcomeChannel) continue;
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) continue;
      await channel
        .send({ embeds: [baseEmbed(COLORS.success).setDescription(formatMessage(template, member)).setThumbnail(member.user.displayAvatarURL())] })
        .catch(() => {});
    }

    if (config.autorole) {
      const role = member.guild.roles.cache.get(config.autorole);
      if (role) await member.roles.add(role).catch(() => {});
    }
  },
};
