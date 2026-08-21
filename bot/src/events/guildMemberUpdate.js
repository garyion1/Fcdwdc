const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { isBotUsable } = require('../utils/premium');

function formatMessage(template, member) {
  return template
    .replaceAll('{user.name}', member.user.tag)
    .replaceAll('{user}', `${member}`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', `${member.guild.memberCount}`)
    .replaceAll('{boosts}', `${member.guild.premiumSubscriptionCount ?? 0}`);
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    if (!isBotUsable(newMember.guild.id)) return;
    const config = getConfig(newMember.guild.id);

    const startedBoosting = !oldMember.premiumSince && newMember.premiumSince;
    const stoppedBoosting = oldMember.premiumSince && !newMember.premiumSince;

    if (startedBoosting) {
      for (const [channelId, template] of Object.entries(config.boostMessages ?? {})) {
        const channel = newMember.guild.channels.cache.get(channelId);
        if (!channel) continue;
        await channel
          .send({ embeds: [baseEmbed(0xf47fff).setDescription(formatMessage(template, newMember)).setThumbnail(newMember.user.displayAvatarURL())] })
          .catch(() => {});
      }

      if (config.boosterRole.awardRoleId) {
        const role = newMember.guild.roles.cache.get(config.boosterRole.awardRoleId);
        if (role?.editable) await newMember.roles.add(role, 'Started boosting').catch(() => {});
      }
    }

    if (stoppedBoosting) {
      // Clean up the personal booster role they no longer qualify for.
      const roleId = config.boosterRole.roles[newMember.id];
      if (roleId) {
        const role = newMember.guild.roles.cache.get(roleId);
        if (role?.editable) await role.delete('No longer boosting').catch(() => {});
        delete config.boosterRole.roles[newMember.id];
        saveConfig(newMember.guild.id);
      }

      if (config.boosterRole.awardRoleId) {
        const award = newMember.guild.roles.cache.get(config.boosterRole.awardRoleId);
        if (award?.editable) await newMember.roles.remove(award, 'Stopped boosting').catch(() => {});
      }
    }
  },
};
