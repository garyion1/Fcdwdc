const { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveConfig } = require('../config/database');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');
const { scheduleTimer, stopTimer } = require('../utils/timers');
const { refreshCounters, COUNTER_TYPES } = require('../utils/counters');
const { ownedChannel } = require('../utils/voicemaster');

const CATEGORY = 'Server';

const LOG_EVENTS = ['messages', 'members', 'roles', 'channels', 'invites', 'emojis', 'voice'];

const BUTTON_STYLES = {
  blurple: ButtonStyle.Primary,
  primary: ButtonStyle.Primary,
  grey: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  secondary: ButtonStyle.Secondary,
  green: ButtonStyle.Success,
  success: ButtonStyle.Success,
  red: ButtonStyle.Danger,
  danger: ButtonStyle.Danger,
};

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

function parseColor(input) {
  if (!input) return null;
  const hex = input.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

// Shared implementation behind welcome / goodbye / boost, which differ only in
// which config map they write to.
function greetingCommand(name, key, emoji, blurb) {
  return {
    name,
    category: CATEGORY,
    description: `${blurb} Usage: ${name} add <#channel> <message> | remove <#channel> | view <#channel> | list`,
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      if (!config[key]) config[key] = {};

      if (action === 'add') {
        const channel = resolveChannel(message, args[1]);
        const text = args.slice(2).join(' ');
        if (!channel || !text) return message.reply(`Usage: \`${name} add <#channel> <message>\``);
        config[key][channel.id] = text;
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [
            baseEmbed(COLORS.success)
              .setDescription(`${emoji} ${channel} will now receive this message.`)
              .setFooter({ text: 'Placeholders: {user} {user.name} {server} {memberCount}' }),
          ],
        });
      }

      if (action === 'remove') {
        const channel = resolveChannel(message, args[1]);
        if (!channel || !config[key][channel.id]) return message.reply(`Usage: \`${name} remove <#channel>\``);
        delete config[key][channel.id];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`${emoji} Removed the message for ${channel}.`)] });
      }

      if (action === 'view') {
        const channel = resolveChannel(message, args[1]);
        if (!channel || !config[key][channel.id]) return message.reply(`Usage: \`${name} view <#channel>\``);
        return message.channel.send({ embeds: [baseEmbed().setTitle(`${name} — #${channel.name}`).setDescription(config[key][channel.id])] });
      }

      const entries = Object.entries(config[key]);
      if (entries.length === 0) return message.channel.send(`No ${name} messages are configured.`);
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`${emoji} ${name} messages (${entries.length})`)
            .setDescription(entries.map(([channelId, text]) => `<#${channelId}> — ${text.slice(0, 80)}`).join('\n').slice(0, 4000)),
        ],
      });
    },
  };
}

module.exports = [
  greetingCommand('welcome', 'welcomeMessages', '👋', 'Greet members when they join.'),
  greetingCommand('goodbye', 'goodbyeMessages', '👋', 'Say goodbye when members leave.'),
  greetingCommand('boost', 'boostMessages', '💜', 'Celebrate members who boost the server.'),
  {
    name: 'starboard',
    category: CATEGORY,
    description: 'Pin the best messages to a starboard. Usage: starboard channel|threshold|emoji|selfstar|color|timestamp|jumpurl|attachments',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const board = config.starboard;

      if (!action || action === 'config') {
        return message.channel.send({
          embeds: [
            baseEmbed()
              .setTitle('⭐ Starboard')
              .setDescription(board.channel ? `Posting to <#${board.channel}>` : 'No starboard channel set — run `starboard channel #channel`.')
              .addFields(
                { name: 'Threshold', value: `${board.threshold}`, inline: true },
                { name: 'Emoji', value: board.emoji, inline: true },
                { name: 'Self-star', value: board.selfStar ? 'Allowed' : 'Ignored', inline: true },
                { name: 'Timestamp', value: board.timestamp ? 'On' : 'Off', inline: true },
                { name: 'Jump URL', value: board.jumpUrl ? 'On' : 'Off', inline: true },
                { name: 'Attachments', value: board.attachments ? 'On' : 'Off', inline: true },
              ),
          ],
        });
      }

      if (action === 'channel') {
        const channel = resolveChannel(message, args[1]);
        if (!channel) return message.reply('Usage: `starboard channel <#channel>`');
        board.channel = channel.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`⭐ Starboard set to ${channel}.`)] });
      }

      if (action === 'threshold') {
        const value = parseInt(args[1], 10);
        if (!Number.isFinite(value) || value < 1) return message.reply('Usage: `starboard threshold <number>`');
        board.threshold = value;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`⭐ Threshold set to **${value}**.`)] });
      }

      if (action === 'emoji') {
        const emoji = args[1];
        if (!emoji) return message.reply('Usage: `starboard emoji <emoji>`');
        board.emoji = emoji;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Starboard emoji set to ${emoji}.`)] });
      }

      if (action === 'color' || action === 'colour') {
        const color = parseColor(args[1]);
        if (color === null) return message.reply('Usage: `starboard color <hex>` e.g. `starboard color #fee75c`');
        board.color = color;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(color).setDescription('Starboard colour updated.')] });
      }

      const toggles = { selfstar: 'selfStar', timestamp: 'timestamp', jumpurl: 'jumpUrl', attachments: 'attachments' };
      if (toggles[action]) {
        const key = toggles[action];
        board[key] = !board[key];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`\`${action}\` is now **${board[key] ? 'on' : 'off'}**.`)] });
      }

      return message.reply('Usage: `starboard channel|threshold|emoji|selfstar|color|timestamp|jumpurl|attachments`');
    },
  },
  {
    name: 'counter',
    category: CATEGORY,
    description: 'Create a stats voice channel. Usage: counter add <type> [format] | counter remove <#channel> | counter list',
    permissions: [PermissionFlagsBits.ManageChannels],
    async execute(message, args, config, client) {
      const action = args[0]?.toLowerCase();

      if (action === 'add') {
        const type = args[1]?.toLowerCase();
        if (!COUNTER_TYPES.includes(type)) return message.reply(`Usage: \`counter add <type> [format]\`\nTypes: ${COUNTER_TYPES.map((t) => `\`${t}\``).join(', ')}`);
        const format = args.slice(2).join(' ') || `${type.charAt(0).toUpperCase() + type.slice(1)}: {count}`;
        if (!format.includes('{count}')) return message.reply('The format needs a `{count}` placeholder, e.g. `Members: {count}`.');

        const channel = await message.guild.channels
          .create({
            name: format.replace('{count}', '0'),
            type: ChannelType.GuildVoice,
            permissionOverwrites: [{ id: message.guild.id, deny: [PermissionFlagsBits.Connect] }],
          })
          .catch(() => null);
        if (!channel) return message.reply('I could not create the channel — check my permissions.');

        config.counters[channel.id] = { type, format };
        saveConfig(message.guild.id);
        await refreshCounters(client);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`📊 Counter created: ${channel}`)] });
      }

      if (action === 'remove') {
        const channel = resolveChannel(message, args[1]);
        if (!channel || !config.counters[channel.id]) return message.reply('Usage: `counter remove <#channel>`');
        delete config.counters[channel.id];
        saveConfig(message.guild.id);
        await channel.delete('Counter removed').catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('📊 Counter removed.')] });
      }

      const entries = Object.entries(config.counters);
      if (entries.length === 0) return message.channel.send('No counters have been created.');
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`Counters (${entries.length})`)
            .setDescription(entries.map(([channelId, counter]) => `<#${channelId}> — \`${counter.type}\``).join('\n')),
        ],
      });
    },
  },
  {
    name: 'timer',
    aliases: ['automessage'],
    category: CATEGORY,
    description: 'Post a message on a repeating schedule. Usage: timer add <#channel> <minutes> <message> | remove | view | list',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config, client) {
      const action = args[0]?.toLowerCase();

      if (action === 'add') {
        const channel = resolveChannel(message, args[1]);
        const minutes = parseInt(args[2], 10);
        const text = args.slice(3).join(' ');
        if (!channel || !Number.isFinite(minutes) || minutes < 1 || !text) return message.reply('Usage: `timer add <#channel> <minutes> <message>`');

        config.timers[channel.id] = { message: text, intervalMinutes: minutes, lastSent: null };
        saveConfig(message.guild.id);
        scheduleTimer(client, message.guild.id, channel.id, minutes);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`⏰ ${channel} will receive that message every **${minutes}** minute(s).`)] });
      }

      if (action === 'remove') {
        const channel = resolveChannel(message, args[1]);
        if (!channel || !config.timers[channel.id]) return message.reply('Usage: `timer remove <#channel>`');
        delete config.timers[channel.id];
        saveConfig(message.guild.id);
        stopTimer(message.guild.id, channel.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`⏰ Timer removed for ${channel}.`)] });
      }

      if (action === 'view') {
        const channel = resolveChannel(message, args[1]);
        const timer = channel ? config.timers[channel.id] : null;
        if (!timer) return message.reply('Usage: `timer view <#channel>`');
        return message.channel.send({
          embeds: [baseEmbed().setTitle(`Timer — #${channel.name}`).setDescription(timer.message).addFields({ name: 'Every', value: `${timer.intervalMinutes} minute(s)` })],
        });
      }

      const entries = Object.entries(config.timers);
      if (entries.length === 0) return message.channel.send('No timers have been created.');
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`Timers (${entries.length})`)
            .setDescription(entries.map(([channelId, timer]) => `<#${channelId}> — every ${timer.intervalMinutes}m`).join('\n')),
        ],
      });
    },
  },
  {
    name: 'bumpreminder',
    aliases: ['bump'],
    category: CATEGORY,
    description: 'Remind the server to bump on Disboard. Usage: bumpreminder channel|message|thankyou|autolock|autoclean|config|on|off',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const reminder = config.bumpReminder;

      if (!action || action === 'config') {
        return message.channel.send({
          embeds: [
            baseEmbed(reminder.enabled ? COLORS.success : COLORS.warning)
              .setTitle('🔔 Bump reminder')
              .setDescription(`Status: **${reminder.enabled ? 'on' : 'off'}**\nChannel: ${reminder.channel ? `<#${reminder.channel}>` : 'not set'}`)
              .addFields(
                { name: 'Reminder', value: reminder.message.slice(0, 1024) },
                { name: 'Thank you', value: reminder.thankYou.slice(0, 1024) },
                { name: 'Auto-lock', value: reminder.autoLock ? 'On' : 'Off', inline: true },
                { name: 'Auto-clean', value: reminder.autoClean ? 'On' : 'Off', inline: true },
              ),
          ],
        });
      }

      if (action === 'on' || action === 'off') {
        reminder.enabled = action === 'on';
        if (reminder.enabled && !reminder.channel) reminder.channel = message.channel.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔔 Bump reminders are now **${action}**.`)] });
      }

      if (action === 'channel') {
        const channel = resolveChannel(message, args[1]) ?? message.channel;
        reminder.channel = channel.id;
        reminder.enabled = true;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔔 Bump reminders will be posted in ${channel}.`)] });
      }

      if (action === 'message' || action === 'thankyou') {
        const text = args.slice(1).join(' ');
        if (!text) return message.reply(`Usage: \`bumpreminder ${action} <text>\``);
        if (action === 'message') reminder.message = text;
        else reminder.thankYou = text;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔔 Updated the ${action === 'message' ? 'reminder' : 'thank you'} message.`)] });
      }

      if (action === 'autolock' || action === 'autoclean') {
        const key = action === 'autolock' ? 'autoLock' : 'autoClean';
        reminder[key] = !reminder[key];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`\`${action}\` is now **${reminder[key] ? 'on' : 'off'}**.`)] });
      }

      return message.reply('Usage: `bumpreminder channel|message|thankyou|autolock|autoclean|config|on|off`');
    },
  },
  {
    name: 'log',
    aliases: ['logs'],
    category: CATEGORY,
    description: 'Send server events to a channel. Usage: log add <event> <#channel> | log remove <event> | log ignore <#channel> | log list',
    permissions: [PermissionFlagsBits.ManageGuild],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();

      if (action === 'add') {
        const event = args[1]?.toLowerCase();
        const channel = resolveChannel(message, args[2]) ?? message.channel;
        if (!LOG_EVENTS.includes(event)) return message.reply(`Usage: \`log add <event> <#channel>\`\nEvents: ${LOG_EVENTS.map((e) => `\`${e}\``).join(', ')}`);
        config.logEvents[event] = channel.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`📋 \`${event}\` events will be logged in ${channel}.`)] });
      }

      if (action === 'remove') {
        const event = args[1]?.toLowerCase();
        if (!config.logEvents[event]) return message.reply(`\`${event}\` is not being logged.`);
        delete config.logEvents[event];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`📋 Stopped logging \`${event}\`.`)] });
      }

      if (action === 'ignore') {
        const sub = args[1]?.toLowerCase();
        if (sub === 'list') {
          if (config.logIgnored.length === 0) return message.channel.send('No channels are ignored by logging.');
          return message.channel.send({
            embeds: [baseEmbed().setTitle('Ignored by logging').setDescription(config.logIgnored.map((id) => `<#${id}>`).join('\n'))],
          });
        }
        const channel = resolveChannel(message, args[1]) ?? message.channel;
        const index = config.logIgnored.indexOf(channel.id);
        if (index === -1) config.logIgnored.push(channel.id);
        else config.logIgnored.splice(index, 1);
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`${channel} is ${index === -1 ? 'now' : 'no longer'} ignored by logging.`)],
        });
      }

      const entries = Object.entries(config.logEvents);
      const configured = entries.length === 0 ? '*Nothing configured*' : entries.map(([event, channelId]) => `\`${event}\` → <#${channelId}>`).join('\n');
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle('📋 Logging')
            .setDescription(configured)
            .addFields({ name: 'Available events', value: LOG_EVENTS.map((e) => `\`${e}\``).join(', ') }),
        ],
      });
    },
  },
  {
    name: 'webhook',
    category: CATEGORY,
    description: 'Manage channel webhooks. Usage: webhook create <#channel> <name> | send <name> <message> | edit <name> <newname> | delete <name> | list',
    permissions: [PermissionFlagsBits.ManageWebhooks],
    async execute(message, args) {
      const action = args[0]?.toLowerCase();

      async function findWebhook(name) {
        for (const channel of message.guild.channels.cache.values()) {
          if (!channel.isTextBased() || channel.isThread()) continue;
          const hooks = await channel.fetchWebhooks().catch(() => null);
          const hook = hooks?.find((h) => h.name.toLowerCase() === name.toLowerCase() && h.token);
          if (hook) return hook;
        }
        return null;
      }

      if (action === 'create') {
        const channel = resolveChannel(message, args[1]);
        const name = args.slice(2).join(' ');
        if (!channel || !name) return message.reply('Usage: `webhook create <#channel> <name>`');
        const hook = await channel.createWebhook({ name: name.slice(0, 80), reason: `Created by ${message.author.tag}` }).catch(() => null);
        if (!hook) return message.reply('I could not create that webhook — check my permissions.');
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🪝 Webhook **${hook.name}** created in ${channel}.`)] });
      }

      if (action === 'send') {
        const name = args[1];
        const text = args.slice(2).join(' ');
        if (!name || !text) return message.reply('Usage: `webhook send <name> <message>`');
        const hook = await findWebhook(name);
        if (!hook) return message.reply('I could not find a webhook with that name that I am able to use.');
        await hook.send(text).catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🪝 Sent through **${hook.name}**.`)] });
      }

      if (action === 'edit') {
        const name = args[1];
        const newName = args.slice(2).join(' ');
        if (!name || !newName) return message.reply('Usage: `webhook edit <name> <new name>`');
        const hook = await findWebhook(name);
        if (!hook) return message.reply('I could not find a webhook with that name.');
        await hook.edit({ name: newName.slice(0, 80) }).catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🪝 Renamed to **${newName}**.`)] });
      }

      if (action === 'delete') {
        const name = args.slice(1).join(' ');
        if (!name) return message.reply('Usage: `webhook delete <name>`');
        const hook = await findWebhook(name);
        if (!hook) return message.reply('I could not find a webhook with that name.');
        await hook.delete(`Deleted by ${message.author.tag}`).catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🪝 Deleted **${name}**.`)] });
      }

      const lines = [];
      for (const channel of message.guild.channels.cache.values()) {
        if (!channel.isTextBased() || channel.isThread()) continue;
        const hooks = await channel.fetchWebhooks().catch(() => null);
        for (const hook of hooks?.values() ?? []) lines.push(`**${hook.name}** — ${channel}`);
      }
      if (lines.length === 0) return message.channel.send('This server has no webhooks.');
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Webhooks (${lines.length})`).setDescription(lines.join('\n').slice(0, 4000))] });
    },
  },
  {
    name: 'buttonrole',
    aliases: ['br'],
    category: CATEGORY,
    description: 'Hand out roles with buttons. Usage: buttonrole add <#channel> <role> <label> [colour] | remove <messageId> <role> | list | removeall <messageId> | reset',
    permissions: [PermissionFlagsBits.ManageRoles],
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();

      function buildRows(entry) {
        const rows = [];
        for (let i = 0; i < entry.roles.length; i += 5) {
          const row = new ActionRowBuilder().addComponents(
            entry.roles.slice(i, i + 5).map((role) =>
              new ButtonBuilder().setCustomId(`boatbot_buttonrole:${role.roleId}`).setLabel(role.label).setStyle(role.style ?? ButtonStyle.Secondary),
            ),
          );
          rows.push(row);
        }
        return rows;
      }

      if (action === 'add') {
        const channel = resolveChannel(message, args[1]) ?? message.channel;
        const role = resolveRole(message, args[2]);
        if (!role) return message.reply('Usage: `buttonrole add <#channel> <role> <label> [colour]`');
        if (!role.editable) return message.reply('I cannot assign that role — move my role above it.');

        const styleArg = args[args.length - 1]?.toLowerCase();
        const hasStyle = BUTTON_STYLES[styleArg] !== undefined && args.length > 4;
        const label = (hasStyle ? args.slice(3, -1) : args.slice(3)).join(' ') || role.name;
        const style = hasStyle ? BUTTON_STYLES[styleArg] : ButtonStyle.Secondary;

        // Attach to the most recent panel in that channel, or start a new one.
        const existing = Object.entries(config.buttonRoles).find(([, entry]) => entry.channelId === channel.id);

        if (existing) {
          const [messageId, entry] = existing;
          if (entry.roles.length >= 25) return message.reply('That panel already has 25 buttons — start a new one in another channel.');
          if (entry.roles.some((r) => r.roleId === role.id)) return message.reply('That role is already on this panel.');
          entry.roles.push({ roleId: role.id, label: label.slice(0, 80), style });
          const panel = await channel.messages.fetch(messageId).catch(() => null);
          if (!panel) {
            delete config.buttonRoles[messageId];
            saveConfig(message.guild.id);
            return message.reply('The existing panel message is gone — run the command again to make a new one.');
          }
          await panel.edit({ components: buildRows(entry) }).catch(() => {});
          saveConfig(message.guild.id);
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Added ${role} to the panel in ${channel}.`)] });
        }

        const entry = { channelId: channel.id, roles: [{ roleId: role.id, label: label.slice(0, 80), style }] };
        const panel = await channel
          .send({
            embeds: [baseEmbed().setTitle('Pick your roles').setDescription('Click a button below to give yourself the role, or click again to remove it.')],
            components: buildRows(entry),
          })
          .catch(() => null);
        if (!panel) return message.reply('I could not post the panel — check my permissions in that channel.');

        config.buttonRoles[panel.id] = entry;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Button role panel created in ${channel}.`)] });
      }

      if (action === 'remove') {
        const messageId = args[1];
        const role = resolveRole(message, args[2]);
        const entry = config.buttonRoles[messageId];
        if (!entry || !role) return message.reply('Usage: `buttonrole remove <messageId> <role>`');
        entry.roles = entry.roles.filter((r) => r.roleId !== role.id);
        const channel = message.guild.channels.cache.get(entry.channelId);
        const panel = await channel?.messages.fetch(messageId).catch(() => null);

        if (entry.roles.length === 0) {
          delete config.buttonRoles[messageId];
          if (panel) await panel.delete().catch(() => {});
        } else if (panel) {
          await panel.edit({ components: buildRows(entry) }).catch(() => {});
        }
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Removed ${role} from that panel.`)] });
      }

      if (action === 'removeall') {
        const messageId = args[1];
        const entry = config.buttonRoles[messageId];
        if (!entry) return message.reply('Usage: `buttonrole removeall <messageId>`');
        const channel = message.guild.channels.cache.get(entry.channelId);
        const panel = await channel?.messages.fetch(messageId).catch(() => null);
        if (panel) await panel.delete().catch(() => {});
        delete config.buttonRoles[messageId];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Panel removed.')] });
      }

      if (action === 'reset') {
        for (const [messageId, entry] of Object.entries(config.buttonRoles)) {
          const channel = message.guild.channels.cache.get(entry.channelId);
          const panel = await channel?.messages.fetch(messageId).catch(() => null);
          if (panel) await panel.delete().catch(() => {});
        }
        config.buttonRoles = {};
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('All button role panels removed.')] });
      }

      const entries = Object.entries(config.buttonRoles);
      if (entries.length === 0) return message.channel.send('No button role panels exist.');
      const lines = entries.map(([messageId, entry]) => `\`${messageId}\` in <#${entry.channelId}> — ${entry.roles.map((r) => `<@&${r.roleId}>`).join(', ')}`);
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Button roles (${entries.length})`).setDescription(lines.join('\n').slice(0, 4000))] });
    },
  },
  {
    name: 'boosterrole',
    aliases: ['br2', 'boostrole'],
    category: CATEGORY,
    description: 'Give boosters their own custom role. Usage: boosterrole <#hex> <name> | base | rename | icon | remove | award | list | cleanup',
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const booster = config.boosterRole;
      const isManager = message.member?.permissions.has(PermissionFlagsBits.ManageGuild);

      if (action === 'base') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        const role = resolveRole(message, args.slice(1).join(' '));
        if (!role) return message.reply('Usage: `boosterrole base <role>` — new booster roles are placed just below this one.');
        booster.baseRoleId = role.id;
        booster.enabled = true;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Booster roles will be created just below ${role}.`)] });
      }

      if (action === 'award') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        const sub = args[1]?.toLowerCase();
        if (sub === 'view') {
          return message.channel.send(booster.awardRoleId ? `Boosters are also given <@&${booster.awardRoleId}>.` : 'No award role is set.');
        }
        if (sub === 'remove') {
          booster.awardRoleId = null;
          saveConfig(message.guild.id);
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Award role cleared.')] });
        }
        const role = resolveRole(message, args.slice(1).join(' '));
        if (!role) return message.reply('Usage: `boosterrole award <role>` · `award view` · `award remove`');
        booster.awardRoleId = role.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Boosters will also receive ${role}.`)] });
      }

      if (action === 'list') {
        const entries = Object.entries(booster.roles);
        if (entries.length === 0) return message.channel.send('No booster roles have been created.');
        return message.channel.send({
          embeds: [
            baseEmbed()
              .setTitle(`Booster roles (${entries.length})`)
              .setDescription(entries.map(([userId, roleId]) => `<@${userId}> → <@&${roleId}>`).join('\n').slice(0, 4000)),
          ],
        });
      }

      if (action === 'cleanup') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        let removed = 0;
        for (const [userId, roleId] of Object.entries(booster.roles)) {
          const member = await message.guild.members.fetch(userId).catch(() => null);
          const role = message.guild.roles.cache.get(roleId);
          if (!member || !member.premiumSince) {
            if (role?.editable) await role.delete('Booster role cleanup — no longer boosting').catch(() => {});
            delete booster.roles[userId];
            removed += 1;
          }
        }
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Cleaned up **${removed}** stale booster role(s).`)] });
      }

      // Everything below is a booster acting on their own role.
      if (!message.member?.premiumSince) return message.reply('Only server boosters can use this. Thanks for considering it!');

      const existingId = booster.roles[message.author.id];
      const existing = existingId ? message.guild.roles.cache.get(existingId) : null;

      if (action === 'remove') {
        if (!existing) return message.reply('You do not have a booster role.');
        await existing.delete('Booster removed their role').catch(() => {});
        delete booster.roles[message.author.id];
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Your booster role has been deleted.')] });
      }

      if (action === 'rename') {
        const name = args.slice(1).join(' ');
        if (!existing || !name) return message.reply('Usage: `boosterrole rename <new name>`');
        await existing.setName(name.slice(0, 100), 'Booster renamed their role').catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Your role is now **${name}**.`)] });
      }

      if (action === 'icon') {
        const icon = args[1];
        if (!existing || !icon) return message.reply('Usage: `boosterrole icon <emoji or image url>`');
        if (!message.guild.features.includes('ROLE_ICONS')) return message.reply('This server needs more boosts before roles can have icons.');
        const ok = await existing.setIcon(icon, 'Booster set their role icon').then(() => true).catch(() => false);
        if (!ok) return message.reply('I could not set that icon — try a standard emoji or a direct image link.');
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('Role icon updated.')] });
      }

      const color = parseColor(args[0]);
      if (color === null) {
        return message.reply('Usage: `boosterrole <#hex> <name>` e.g. `boosterrole #ff8800 Sunset` · also `rename` `icon` `remove`');
      }
      const name = args.slice(1).join(' ') || message.author.username;

      if (existing) {
        await existing.edit({ color, name: name.slice(0, 100) }, 'Booster updated their role').catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(color).setDescription(`Updated your role: **${name}**.`)] });
      }

      const role = await message.guild.roles.create({ name: name.slice(0, 100), color, reason: `Booster role for ${message.author.tag}` }).catch(() => null);
      if (!role) return message.reply('I could not create the role — check my permissions.');

      if (booster.baseRoleId) {
        const base = message.guild.roles.cache.get(booster.baseRoleId);
        if (base) await role.setPosition(Math.max(base.position - 1, 1)).catch(() => {});
      }

      await message.member.roles.add(role, 'Booster role').catch(() => {});
      if (booster.awardRoleId) {
        const award = message.guild.roles.cache.get(booster.awardRoleId);
        if (award?.editable) await message.member.roles.add(award, 'Booster award role').catch(() => {});
      }

      booster.roles[message.author.id] = role.id;
      booster.enabled = true;
      saveConfig(message.guild.id);
      return message.channel.send({ embeds: [baseEmbed(color).setDescription(`Created your booster role: ${role}`)] });
    },
  },
  {
    name: 'voicemaster',
    aliases: ['vm', 'voice'],
    category: CATEGORY,
    description: 'Join-to-create voice channels. Usage: voicemaster setup | default name|bitrate|region | join role | rename|limit|lock|unlock|ghost|permit|claim|transfer',
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const vm = config.voicemaster;
      const isManager = message.member?.permissions.has(PermissionFlagsBits.ManageGuild);

      if (action === 'setup') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        const category = await message.guild.channels.create({ name: 'Voice Channels', type: ChannelType.GuildCategory }).catch(() => null);
        const joinChannel = await message.guild.channels
          .create({ name: '➕ Join to Create', type: ChannelType.GuildVoice, parent: category?.id ?? null })
          .catch(() => null);
        if (!joinChannel) return message.reply('I could not create the channels — check my permissions.');

        vm.enabled = true;
        vm.joinChannel = joinChannel.id;
        vm.categoryId = category?.id ?? null;
        saveConfig(message.guild.id);
        return message.channel.send({
          embeds: [baseEmbed(COLORS.success).setDescription(`🔊 VoiceMaster is ready — join ${joinChannel} to get your own channel.`)],
        });
      }

      if (action === 'off' || action === 'disable') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        vm.enabled = false;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('🔊 VoiceMaster disabled.')] });
      }

      if (action === 'default') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        const key = args[1]?.toLowerCase();
        const value = args.slice(2).join(' ');
        if (key === 'name') {
          if (!value) return message.reply('Usage: `voicemaster default name <name>` — `{user}` is replaced with the owner.');
          vm.defaultName = value;
        } else if (key === 'bitrate') {
          const rate = parseInt(value, 10);
          if (!Number.isFinite(rate) || rate < 8 || rate > 384) return message.reply('Usage: `voicemaster default bitrate <8-384>` (kbps)');
          vm.defaultBitrate = rate;
        } else if (key === 'region') {
          vm.defaultRegion = value && value.toLowerCase() !== 'auto' ? value : null;
        } else {
          return message.reply('Usage: `voicemaster default <name|bitrate|region> <value>`');
        }
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Default \`${key}\` updated.`)] });
      }

      if (action === 'join' && args[1]?.toLowerCase() === 'role') {
        if (!isManager) return message.reply("You don't have permission to do that.");
        const role = resolveRole(message, args.slice(2).join(' '));
        if (!role) return message.reply('Usage: `voicemaster join role <role>`');
        vm.joinRole = role.id;
        saveConfig(message.guild.id);
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Members in a VoiceMaster channel will get ${role}.`)] });
      }

      // Owner-only actions on the caller's own temp channel.
      const OWNER_ACTIONS = ['rename', 'limit', 'lock', 'unlock', 'ghost', 'unghost', 'permit', 'reject', 'transfer', 'bitrate'];
      if (OWNER_ACTIONS.includes(action)) {
        const owned = ownedChannel(message.member);
        if (owned.error) return message.reply(owned.error);
        const channel = owned.channel;
        const everyone = message.guild.roles.everyone;

        if (action === 'rename') {
          const name = args.slice(1).join(' ');
          if (!name) return message.reply('Usage: `voicemaster rename <name>`');
          await channel.setName(name.slice(0, 100)).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Renamed your channel to **${name}**.`)] });
        }

        if (action === 'limit') {
          const limit = parseInt(args[1], 10);
          if (!Number.isFinite(limit) || limit < 0 || limit > 99) return message.reply('Usage: `voicemaster limit <0-99>` (0 = unlimited)');
          await channel.setUserLimit(limit).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(limit === 0 ? 'User limit removed.' : `User limit set to **${limit}**.`)] });
        }

        if (action === 'bitrate') {
          const rate = parseInt(args[1], 10);
          if (!Number.isFinite(rate) || rate < 8) return message.reply('Usage: `voicemaster bitrate <kbps>`');
          await channel.setBitrate(Math.min(rate * 1000, message.guild.maximumBitrate)).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`Bitrate set to **${rate}kbps**.`)] });
        }

        if (action === 'lock' || action === 'unlock') {
          await channel.permissionOverwrites.edit(everyone, { Connect: action === 'lock' ? false : null }).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔊 Channel ${action === 'lock' ? 'locked' : 'unlocked'}.`)] });
        }

        if (action === 'ghost' || action === 'unghost') {
          await channel.permissionOverwrites.edit(everyone, { ViewChannel: action === 'ghost' ? false : null }).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`🔊 Channel ${action === 'ghost' ? 'hidden' : 'visible'}.`)] });
        }

        if (action === 'permit' || action === 'reject') {
          const user = await resolveUser(message, args[1]);
          if (!user) return message.reply(`Usage: \`voicemaster ${action} @user\``);
          await channel.permissionOverwrites
            .edit(user.id, action === 'permit' ? { Connect: true, ViewChannel: true } : { Connect: false })
            .catch(() => {});
          return message.channel.send({
            embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** ${action === 'permit' ? 'can now join' : 'can no longer join'} your channel.`)],
          });
        }

        if (action === 'transfer') {
          const user = await resolveUser(message, args[1]);
          if (!user) return message.reply('Usage: `voicemaster transfer @user`');
          if (!channel.members.has(user.id)) return message.reply('They need to be in your channel first.');
          vm.active[channel.id] = user.id;
          saveConfig(message.guild.id);
          await channel.permissionOverwrites.edit(user.id, { ManageChannels: true, MoveMembers: true }).catch(() => {});
          return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${user.tag}** now owns this channel.`)] });
        }
      }

      if (action === 'claim') {
        const channel = message.member?.voice?.channel;
        if (!channel || !vm.active[channel.id]) return message.reply('You need to be in a VoiceMaster channel.');
        const ownerId = vm.active[channel.id];
        if (ownerId === message.author.id) return message.reply('You already own this channel.');
        if (channel.members.has(ownerId)) return message.reply('The owner is still here — you cannot claim it.');
        vm.active[channel.id] = message.author.id;
        saveConfig(message.guild.id);
        await channel.permissionOverwrites.edit(message.author.id, { ManageChannels: true, MoveMembers: true }).catch(() => {});
        return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription('You now own this channel.')] });
      }

      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle('🔊 VoiceMaster')
            .setDescription(vm.enabled ? `Join <#${vm.joinChannel}> to get your own voice channel.` : 'Not set up — an admin can run `voicemaster setup`.')
            .addFields(
              { name: 'Owner commands', value: '`rename` `limit` `bitrate` `lock` `unlock` `ghost` `unghost` `permit` `reject` `transfer` `claim`' },
              { name: 'Admin commands', value: '`setup` `off` `default name|bitrate|region` `join role`' },
            ),
        ],
      });
    },
  },
];
