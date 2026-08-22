const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');
const { resolvePermissionName } = require('../utils/fakePermissions');
const { canConfigureAntinuke } = require('../utils/antinuke');

const CATEGORY = 'Configuration';

const ANTINUKE_MODULES = ['vanity', 'botadd', 'ban', 'kick', 'role', 'channel', 'emoji', 'webhook'];

function resolveRole(message, arg) {
  if (!arg) return null;
  return (
    message.mentions.roles.first() ??
    message.guild.roles.cache.get(arg.replace(/[<@&>]/g, '')) ??
    message.guild.roles.cache.find((r) => r.name.toLowerCase() === arg.toLowerCase()) ??
    null
  );
}

function resolveChannel(message, arg) {
  if (!arg) return null;
  return message.mentions.channels.first() ?? message.guild.channels.cache.get(arg.replace(/[<#>]/g, '')) ?? null;
}

function onOff(value) {
  return value ? '`on`' : '`off`';
}

module.exports = [
  {
    name: 'setup',
    category: CATEGORY,
    description: 'Create the channels and roles Boat Bot needs in one go. Usage: setup',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args, config) {
      const guild = message.guild;
      const created = [];

      if (!config.modLogChannel || !guild.channels.cache.has(config.modLogChannel)) {
        const channel = await guild.channels
          .create({
            name: 'mod-logs',
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
          })
          .catch(() => null);
        if (channel) {
          config.modLogChannel = channel.id;
          created.push(`Mod log → ${channel}`);
        }
      }

      if (!config.logChannel || !guild.channels.cache.has(config.logChannel)) {
        const channel = await guild.channels
          .create({
            name: 'server-logs',
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
          })
          .catch(() => null);
        if (channel) {
          config.logChannel = channel.id;
          created.push(`Server log → ${channel}`);
        }
      }

      if (!config.jail.roleId || !guild.roles.cache.has(config.jail.roleId)) {
        const role = await guild.roles.create({ name: 'Jailed', color: 0x2b2d31, reason: 'Boat Bot setup' }).catch(() => null);
        if (role) {
          config.jail.roleId = role.id;
          created.push(`Jail role → ${role}`);
        }
      }

      if (!config.jail.channelId || !guild.channels.cache.has(config.jail.channelId)) {
        const overwrites = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];
        if (config.jail.roleId) {
          overwrites.push({ id: config.jail.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        }
        const channel = await guild.channels.create({ name: 'jail', type: ChannelType.GuildText, permissionOverwrites: overwrites }).catch(() => null);
        if (channel) {
          config.jail.channelId = channel.id;
          created.push(`Jail channel → ${channel}`);
        }
      }

      saveConfig(guild.id);

      if (created.length === 0) {
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Everything is already set up — nothing to create.')] });
      }
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setTitle('✅ Setup complete').setDescription(created.join('\n'))],
      });
    },
  },
  {
    name: 'setupmute',
    category: CATEGORY,
    description: 'Create a Muted role and deny it from speaking in every channel. Usage: setupmute',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args, config) {
      const guild = message.guild;
      let role = config.mutedRole ? guild.roles.cache.get(config.mutedRole) : null;

      if (!role) {
        role = await guild.roles.create({ name: 'Muted', color: 0x2b2d31, reason: 'Boat Bot mute setup' }).catch(() => null);
        if (!role) return message.reply('I could not create the Muted role — check my permissions.');
        config.mutedRole = role.id;
        saveConfig(guild.id);
      }

      const notice = await message.channel.send(`Applying **${role.name}** overwrites across every channel...`);

      let updated = 0;
      for (const channel of guild.channels.cache.values()) {
        if (channel.isThread()) continue;
        const denies = { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false };
        if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) denies.Speak = false;
        const ok = await channel.permissionOverwrites.edit(role, denies, { reason: 'Boat Bot mute setup' }).then(() => true).catch(() => false);
        if (ok) updated += 1;
      }

      return notice.edit({
        content: null,
        embeds: [baseEmbed(COLORS.success).setDescription(`✅ **${role.name}** is ready — overwrites applied in ${updated} channel(s).`)],
      });
    },
  },
  {
    name: 'bind',
    category: CATEGORY,
    description: 'Mark roles as staff. Usage: bind staff <role> | bind staff list | bind staff remove <role>',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args, config) {
      if (args[0]?.toLowerCase() !== 'staff') return message.reply('Usage: `bind staff <role>` · `bind staff list` · `bind staff remove <role>`');
      const action = args[1]?.toLowerCase();

      if (action === 'list') {
        if (config.staffRoles.length === 0) return message.channel.send('No staff roles are bound yet.');
        const list = config.staffRoles.map((id) => message.guild.roles.cache.get(id)).filter(Boolean).map((r) => `${r}`).join('\n');
        return message.channel.send({ embeds: [baseEmbed().setTitle(`Staff roles (${config.staffRoles.length})`).setDescription(list || 'None')] });
      }

      if (action === 'remove') {
        const role = resolveRole(message, args.slice(2).join(' '));
        if (!role) return message.reply('Usage: `bind staff remove <role>`');
        if (!config.staffRoles.includes(role.id)) return message.reply('That role is not bound as staff.');
        config.staffRoles = config.staffRoles.filter((id) => id !== role.id);
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`${role} is no longer a staff role.`)] });
      }

      const role = resolveRole(message, args.slice(1).join(' '));
      if (!role) return message.reply('Usage: `bind staff <role>`');
      if (config.staffRoles.includes(role.id)) return message.reply('That role is already bound as staff.');
      config.staffRoles.push(role.id);
      saveConfig(message.guild.id);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`${role} is now a staff role.`)] });
    },
  },
  {
    name: 'fakepermissions',
    aliases: ['fakeperms', 'fp'],
    category: CATEGORY,
    description: 'Let a role use bot commands without real Discord permissions. Usage: fakepermissions add|remove|list|reset [role] [permissions]',
    permissions: [PermissionFlagsBits.Administrator],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();

      if (action === 'reset') {
        config.fakePermissions = {};
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('All fake permissions have been cleared.')] });
      }

      if (action === 'list') {
        const roleArg = args.slice(1).join(' ');
        if (roleArg) {
          const role = resolveRole(message, roleArg);
          if (!role) return message.reply('Could not find that role.');
          const perms = config.fakePermissions[role.id] ?? [];
          if (perms.length === 0) return message.channel.send(`${role} has no fake permissions.`);
          return message.channel.send({
            embeds: [baseEmbed().setTitle(`Fake permissions — ${role.name}`).setDescription(perms.map((p) => `\`${p}\``).join(', '))],
          });
        }

        const entries = Object.entries(config.fakePermissions).filter(([, perms]) => perms.length > 0);
        if (entries.length === 0) return message.channel.send('No fake permissions have been set up.');
        const lines = entries.map(([roleId, perms]) => {
          const role = message.guild.roles.cache.get(roleId);
          return `${role ?? `\`${roleId}\``} — ${perms.map((p) => `\`${p}\``).join(', ')}`;
        });
        return message.channel.send({ embeds: [baseEmbed().setTitle('Fake permissions').setDescription(lines.join('\n').slice(0, 4000))] });
      }

      if (action !== 'add' && action !== 'remove') {
        return message.reply('Usage: `fakepermissions add <role> <permissions>` · `remove <role> <permissions>` · `list [role]` · `reset`');
      }

      const role = resolveRole(message, args[1]);
      if (!role) return message.reply(`Usage: \`fakepermissions ${action} <role> <permissions>\``);

      const rawInput = args.slice(2).join(' ').trim();
      if (!rawInput) return message.reply('Name at least one permission, e.g. `BanMembers` or `ban members`.');

      // Permission names can be written several ways — "BanMembers",
      // "ban members", or a comma-separated mix of both. Try each comma-
      // separated chunk whole first (so "ban members" survives), and only fall
      // back to splitting on spaces when the whole chunk isn't a permission.
      const resolved = [];
      const unknown = [];
      for (const chunk of rawInput.split(',').map((c) => c.trim()).filter(Boolean)) {
        const whole = resolvePermissionName(chunk);
        if (whole) {
          resolved.push(whole);
          continue;
        }
        for (const word of chunk.split(/\s+/).filter(Boolean)) {
          const name = resolvePermissionName(word);
          if (name) resolved.push(name);
          else unknown.push(word);
        }
      }
      if (resolved.length === 0) return message.reply(`None of those are real permissions: ${unknown.map((u) => `\`${u}\``).join(', ')}`);

      const current = new Set(config.fakePermissions[role.id] ?? []);
      for (const name of resolved) {
        if (action === 'add') current.add(name);
        else current.delete(name);
      }
      config.fakePermissions[role.id] = [...current];
      if (config.fakePermissions[role.id].length === 0) delete config.fakePermissions[role.id];
      saveConfig(message.guild.id);

      const verb = action === 'add' ? 'granted to' : 'removed from';
      const note = unknown.length > 0 ? `\nIgnored (not real permissions): ${unknown.map((u) => `\`${u}\``).join(', ')}` : '';
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`${resolved.map((p) => `\`${p}\``).join(', ')} ${verb} ${role}.${note}`)],
      });
    },
  },
  {
    name: 'antinuke',
    category: CATEGORY,
    description: 'Protect the server against mass destruction. Usage: antinuke <module> on|off · config · list · admins · whitelist · permissions',
    async execute(message, args, config) {
      if (!canConfigureAntinuke(message.member)) {
        return message.reply('Only the server owner and antinuke admins can configure antinuke.');
      }

      const action = args[0]?.toLowerCase();

      if (!action || action === 'config' || action === 'list') {
        const modules = ANTINUKE_MODULES.map((mod) => `\`${mod}\` — ${onOff(config.antinuke[mod])}`).join('\n');
        const logChannel = config.antinuke.logChannel ? `<#${config.antinuke.logChannel}>` : 'mod log channel';
        return message.channel.send({
          embeds: [
            baseEmbed(config.antinuke.enabled ? COLORS.success : COLORS.warning)
              .setTitle('🛡️ Antinuke configuration')
              .setDescription(`Master switch: ${onOff(config.antinuke.enabled)}\nPunishment: \`${config.antinuke.punishment}\`\nLogs: ${logChannel}`)
              .addFields(
                { name: 'Modules', value: modules },
                { name: 'Admins', value: `${config.antinuke.admins.length}`, inline: true },
                { name: 'Whitelisted', value: `${config.antinuke.whitelist.length}`, inline: true },
              ),
          ],
        });
      }

      if (action === 'on' || action === 'off' || action === 'enable' || action === 'disable') {
        config.antinuke.enabled = action === 'on' || action === 'enable';
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`🛡️ Antinuke is now ${onOff(config.antinuke.enabled)}.`)],
        });
      }

      if (action === 'punishment') {
        const value = args[1]?.toLowerCase();
        if (!['ban', 'kick', 'strip'].includes(value)) return message.reply('Usage: `antinuke punishment <ban|kick|strip>`');
        config.antinuke.punishment = value;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Antinuke punishment set to \`${value}\`.`)] });
      }

      if (action === 'logs' || action === 'log') {
        const channel = resolveChannel(message, args[1]);
        if (!channel) return message.reply('Usage: `antinuke logs #channel`');
        config.antinuke.logChannel = channel.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Antinuke logs will go to ${channel}.`)] });
      }

      if (action === 'admins') {
        if (config.antinuke.admins.length === 0) return message.channel.send('No antinuke admins — only the server owner can configure antinuke.');
        return message.channel.send({
          embeds: [baseEmbed().setTitle(`Antinuke admins (${config.antinuke.admins.length})`).setDescription(config.antinuke.admins.map((id) => `<@${id}>`).join('\n'))],
        });
      }

      if (action === 'permissions') {
        const sub = args[1]?.toLowerCase();
        const user = await resolveUser(message, args[2]);
        if (!['grant', 'remove'].includes(sub) || !user) return message.reply('Usage: `antinuke permissions grant @user` · `antinuke permissions remove @user`');
        if (message.member.id !== message.guild.ownerId) return message.reply('Only the server owner can change who administers antinuke.');

        if (sub === 'grant') {
          if (config.antinuke.admins.includes(user.id)) return message.reply('They are already an antinuke admin.');
          config.antinuke.admins.push(user.id);
        } else {
          config.antinuke.admins = config.antinuke.admins.filter((id) => id !== user.id);
        }
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** ${sub === 'grant' ? 'can now' : 'can no longer'} configure antinuke.`)],
        });
      }

      if (action === 'whitelist') {
        const target = args[1];
        if (!target) {
          if (config.antinuke.whitelist.length === 0) return message.channel.send('Nobody is whitelisted from antinuke.');
          return message.channel.send({
            embeds: [
              baseEmbed().setTitle(`Antinuke whitelist (${config.antinuke.whitelist.length})`).setDescription(config.antinuke.whitelist.map((id) => `<@${id}>`).join('\n')),
            ],
          });
        }

        const user = await resolveUser(message, target);
        if (!user) return message.reply('Usage: `antinuke whitelist @user`');
        const index = config.antinuke.whitelist.indexOf(user.id);
        if (index === -1) config.antinuke.whitelist.push(user.id);
        else config.antinuke.whitelist.splice(index, 1);
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** was ${index === -1 ? 'added to' : 'removed from'} the antinuke whitelist.`)],
        });
      }

      if (ANTINUKE_MODULES.includes(action)) {
        const value = args[1]?.toLowerCase();
        if (value !== 'on' && value !== 'off') return message.reply(`Usage: \`antinuke ${action} <on|off>\``);
        config.antinuke[action] = value === 'on';
        if (config.antinuke[action]) config.antinuke.enabled = true;
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `🛡️ \`${action}\` protection is now ${onOff(config.antinuke[action])}.${config.antinuke.enabled ? '' : '\nThe antinuke master switch is off — run `antinuke on`.'}`,
            ),
          ],
        });
      }

      return message.reply(`Unknown antinuke option. Modules: ${ANTINUKE_MODULES.map((m) => `\`${m}\``).join(', ')}`);
    },
  },
  {
    name: 'alias',
    category: CATEGORY,
    description: 'Create your own name for an existing command. Usage: alias add <alias> <command> | remove <alias> | view <alias> | list',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config, client) {
      const action = args[0]?.toLowerCase();

      if (action === 'add') {
        const alias = args[1]?.toLowerCase();
        const target = args[2]?.toLowerCase();
        if (!alias || !target) return message.reply('Usage: `alias add <alias> <command>`');
        if (client.prefixCommands.has(alias)) return message.reply(`\`${alias}\` is already a built-in command.`);
        if (!client.prefixCommands.has(target)) return message.reply(`\`${target}\` is not a command.`);
        config.aliases[alias] = target;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`\`${alias}\` now runs \`${target}\`.`)] });
      }

      if (action === 'remove') {
        const alias = args[1]?.toLowerCase();
        if (!alias || !config.aliases[alias]) return message.reply('That alias does not exist.');
        delete config.aliases[alias];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Alias \`${alias}\` removed.`)] });
      }

      if (action === 'view') {
        const alias = args[1]?.toLowerCase();
        if (!alias || !config.aliases[alias]) return message.reply('That alias does not exist.');
        return message.channel.send(`\`${alias}\` → \`${config.aliases[alias]}\``);
      }

      const entries = Object.entries(config.aliases);
      if (entries.length === 0) return message.channel.send('No aliases have been created.');
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`Aliases (${entries.length})`)
            .setDescription(entries.map(([alias, target]) => `\`${alias}\` → \`${target}\``).join('\n').slice(0, 4000)),
        ],
      });
    },
  },
  {
    name: 'autoresponder',
    aliases: ['ar'],
    category: CATEGORY,
    description: 'Reply automatically to a trigger phrase. Usage: autoresponder add <trigger> | <response>  ·  remove/update/list/reset/exclusive/role',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const rest = args.slice(1).join(' ');

      if (action === 'add' || action === 'update') {
        const [triggerPart, ...responseParts] = rest.split('|');
        const trigger = triggerPart?.trim().toLowerCase();
        const response = responseParts.join('|').trim();
        if (!trigger || !response) return message.reply(`Usage: \`autoresponder ${action} <trigger> | <response>\``);
        if (action === 'add' && config.autoresponders[trigger]) return message.reply('That trigger already exists — use `autoresponder update`.');
        if (action === 'update' && !config.autoresponders[trigger]) return message.reply('That trigger does not exist — use `autoresponder add`.');

        config.autoresponders[trigger] = {
          response,
          exclusive: config.autoresponders[trigger]?.exclusive ?? false,
          roleIds: config.autoresponders[trigger]?.roleIds ?? [],
        };
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Autoresponder for \`${trigger}\` saved.`)] });
      }

      if (action === 'remove') {
        const trigger = rest.trim().toLowerCase();
        if (!config.autoresponders[trigger]) return message.reply('That trigger does not exist.');
        delete config.autoresponders[trigger];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Autoresponder for \`${trigger}\` removed.`)] });
      }

      if (action === 'reset') {
        config.autoresponders = {};
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('All autoresponders cleared.')] });
      }

      if (action === 'exclusive') {
        const trigger = rest.trim().toLowerCase();
        const entry = config.autoresponders[trigger];
        if (!entry) return message.reply('That trigger does not exist.');
        entry.exclusive = !entry.exclusive;
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `\`${trigger}\` now matches ${entry.exclusive ? '**only when the message is exactly the trigger**' : '**anywhere in a message**'}.`,
            ),
          ],
        });
      }

      if (action === 'role') {
        const sub = args[1]?.toLowerCase();
        const trigger = args[2]?.toLowerCase();
        const role = resolveRole(message, args.slice(3).join(' '));
        if (!['add', 'remove'].includes(sub) || !trigger || !role) return message.reply('Usage: `autoresponder role add|remove <trigger> <role>`');
        const entry = config.autoresponders[trigger];
        if (!entry) return message.reply('That trigger does not exist.');

        if (sub === 'add') {
          if (!entry.roleIds.includes(role.id)) entry.roleIds.push(role.id);
        } else {
          entry.roleIds = entry.roleIds.filter((id) => id !== role.id);
        }
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              entry.roleIds.length === 0
                ? `\`${trigger}\` now responds to everyone.`
                : `\`${trigger}\` now responds only to: ${entry.roleIds.map((id) => `<@&${id}>`).join(', ')}`,
            ),
          ],
        });
      }

      const entries = Object.entries(config.autoresponders);
      if (entries.length === 0) return message.channel.send('No autoresponders have been created.');
      const lines = entries.map(([trigger, entry]) => {
        const flags = [entry.exclusive ? 'exact' : null, entry.roleIds.length > 0 ? `${entry.roleIds.length} role(s)` : null].filter(Boolean);
        return `\`${trigger}\`${flags.length ? ` *(${flags.join(', ')})*` : ''} → ${entry.response.slice(0, 80)}`;
      });
      return message.channel.send({
        embeds: [baseEmbed().setTitle(`Autoresponders (${entries.length})`).setDescription(lines.join('\n').slice(0, 4000))],
      });
    },
  },
  {
    name: 'invoke',
    category: CATEGORY,
    description: 'Customise what a moderation command says. Usage: invoke <command> message <text> | invoke <command> dm <text> | invoke <command> reset',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const command = args[0]?.toLowerCase();
      const mode = args[1]?.toLowerCase();
      const text = args.slice(2).join(' ');

      const SUPPORTED = ['ban', 'tempban', 'softban', 'hardban', 'kick', 'timeout', 'warn', 'jail'];
      if (!command || !SUPPORTED.includes(command)) {
        return message.reply(`Usage: \`invoke <command> <message|dm> <text>\`\nSupported: ${SUPPORTED.map((c) => `\`${c}\``).join(', ')}`);
      }

      if (mode === 'reset') {
        delete config.invokeMessages[command];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`\`${command}\` messages reset to the defaults.`)] });
      }

      if (mode === 'view') {
        const entry = config.invokeMessages[command] ?? {};
        return message.channel.send({
          embeds: [
            baseEmbed()
              .setTitle(`invoke — ${command}`)
              .addFields(
                { name: 'Channel message', value: entry.message ?? '*default*' },
                { name: 'DM to the member', value: entry.dm ?? '*default*' },
              ),
          ],
        });
      }

      if ((mode !== 'message' && mode !== 'dm') || !text) {
        return message.reply(`Usage: \`invoke ${command} message <text>\` · \`invoke ${command} dm <text>\` · \`invoke ${command} view\` · \`invoke ${command} reset\``);
      }

      if (!config.invokeMessages[command]) config.invokeMessages[command] = {};
      config.invokeMessages[command][mode] = text;
      saveConfig(message.guild.id);

      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.success)
            .setDescription(`\`${command}\` ${mode === 'dm' ? 'DM' : 'channel message'} updated.`)
            .setFooter({ text: 'Placeholders: {user} {user.name} {user.id} {moderator} {reason} {server}' }),
        ],
      });
    },
  },
  {
    name: 'autorole',
    category: CATEGORY,
    description: 'Give new members a role automatically. Usage: autorole add <role> [humans|bots] | remove <role> | list | reset',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();

      if (action === 'add') {
        const role = resolveRole(message, args[1]);
        const targetArg = args[2]?.toLowerCase();
        const target = ['humans', 'bots'].includes(targetArg) ? targetArg : 'all';
        if (!role) return message.reply('Usage: `autorole add <role> [humans|bots]` — leave the target off to apply to everyone.');
        if (!role.editable) return message.reply('I cannot assign that role — move my role above it.');
        if (config.autoroles.some((entry) => entry.roleId === role.id)) return message.reply('That role is already an autorole.');

        config.autoroles.push({ roleId: role.id, target });
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success).setDescription(
              `${role} will now be given automatically to ${target === 'all' ? 'every new member' : `new ${target}`}.`,
            ),
          ],
        });
      }

      if (action === 'remove') {
        const role = resolveRole(message, args[1]);
        if (!role) return message.reply('Usage: `autorole remove <role>`');
        const before = config.autoroles.length;
        config.autoroles = config.autoroles.filter((entry) => entry.roleId !== role.id);
        if (config.autoroles.length === before) return message.reply('That role is not an autorole.');

        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`${role} is no longer an autorole.`)] });
      }

      if (action === 'reset') {
        config.autoroles = [];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('All autoroles cleared.')] });
      }

      if (config.autoroles.length === 0) return message.channel.send('No autoroles are set up — add one with `autorole add <role>`.');
      const lines = config.autoroles.map((entry) => `<@&${entry.roleId}> — ${entry.target}`);
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Autoroles (${config.autoroles.length})`).setDescription(lines.join('\n'))] });
    },
  },
];
