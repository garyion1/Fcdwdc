const { PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../config/database');

const PERMISSION_NAMES = Object.keys(PermissionFlagsBits);

// Accepts "ban members", "BanMembers", "ban_members" etc. and returns the
// canonical discord.js flag name, or null if it isn't a real permission.
function resolvePermissionName(input) {
  if (!input) return null;
  const target = input.replace(/[^a-z]/gi, '').toLowerCase();
  return PERMISSION_NAMES.find((name) => name.toLowerCase() === target) ?? null;
}

function grantedPermissionNames(member) {
  if (!member?.guild) return new Set();
  const config = getConfig(member.guild.id);
  const names = new Set();
  for (const [roleId, perms] of Object.entries(config.fakePermissions)) {
    if (!member.roles.cache.has(roleId)) continue;
    for (const name of perms) names.add(name);
  }
  return names;
}

// Fake permissions only ever apply to Boat Bot's own commands — they never
// touch a member's real Discord permissions, so a role granted "BanMembers"
// here can ban through the bot without being able to ban natively.
function hasCommandPermissions(member, required) {
  // No member or no guild context means no way to verify — deny rather than
  // throw out of the permission check.
  if (!member?.guild) return false;
  const list = Array.isArray(required) ? required : [required];
  if (member.permissions.has(list)) return true;

  const granted = grantedPermissionNames(member);
  if (granted.size === 0) return false;

  const grantedFlags = [...granted].map((name) => PermissionFlagsBits[name]).filter(Boolean);
  return list.every((flag) => member.permissions.has(flag) || grantedFlags.includes(flag));
}

module.exports = { resolvePermissionName, hasCommandPermissions, grantedPermissionNames, PERMISSION_NAMES };
