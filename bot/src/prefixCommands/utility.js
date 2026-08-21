const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');
const { saveConfig } = require('../config/database');
const { getDeleted, getEdited } = require('../utils/snipe');

const CATEGORY = 'Utility';

function formatChannel(channel) {
  if (channel.type === ChannelType.GuildCategory) return `📁 ${channel.name}`;
  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) return `🔊 ${channel.name}`;
  return `#${channel.name}`;
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = [
  {
    name: 'ping',
    category: CATEGORY,
    description: "Check the bot's latency.",
    async execute(message, args, config, client) {
      const sent = await message.channel.send('Pinging...');
      const latency = sent.createdTimestamp - message.createdTimestamp;
      await sent.edit(`🏓 Pong! Latency: ${latency}ms | API: ${Math.round(client.ws.ping)}ms`);
    },
  },
  {
    name: 'avatar',
    category: CATEGORY,
    description: "Show a member's avatar. Usage: avatar [@user]",
    async execute(message, args) {
      const user = (await resolveUser(message, args[0])) ?? message.author;
      return message.channel.send({ embeds: [baseEmbed().setTitle(`${user.tag}'s avatar`).setImage(user.displayAvatarURL({ size: 1024 }))] });
    },
  },
  {
    name: 'userinfo',
    aliases: ['whois'],
    category: CATEGORY,
    description: 'Show information about a member. Usage: userinfo [@user]',
    async execute(message, args) {
      const user = (await resolveUser(message, args[0])) ?? message.author;
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      const embed = baseEmbed()
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
        );
      if (member) {
        embed.addFields(
          { name: 'Joined server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Unknown', inline: true },
          { name: 'Roles', value: member.roles.cache.filter((r) => r.id !== message.guild.id).map((r) => `${r}`).join(' ') || 'None' },
        );
      }
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'serverinfo',
    aliases: ['guildinfo'],
    category: CATEGORY,
    description: 'Show information about this server.',
    async execute(message) {
      const guild = message.guild;
      const embed = baseEmbed()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        );
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'roleinfo',
    category: CATEGORY,
    description: 'Show information about a role. Usage: roleinfo <@role|name>',
    async execute(message, args) {
      if (!args[0]) return message.reply('Usage: `roleinfo <@role|name>`');
      const role =
        message.mentions.roles.first() ??
        message.guild.roles.cache.get(args[0]) ??
        message.guild.roles.cache.find((r) => r.name.toLowerCase() === args.join(' ').toLowerCase());
      if (!role) return message.reply('Could not find that role.');
      const embed = baseEmbed(role.color || undefined)
        .setTitle(role.name)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Members', value: `${role.members.size}`, inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
        );
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'banner',
    category: CATEGORY,
    description: "Show a user's profile banner. Usage: banner [@user]",
    async execute(message, args, config, client) {
      const target = (await resolveUser(message, args[0])) ?? message.author;
      const user = await client.users.fetch(target.id, { force: true });
      if (!user.banner) return message.channel.send(`${user.tag} does not have a banner set.`);
      return message.channel.send({ embeds: [baseEmbed().setTitle(`${user.tag}'s banner`).setImage(user.bannerURL({ size: 1024 }))] });
    },
  },
  {
    name: 'invite',
    category: CATEGORY,
    description: 'Get an invite link to add the bot to another server.',
    async execute(message, args, config, client) {
      const link = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
      return message.channel.send(`Invite me to your server: ${link}`);
    },
  },
  {
    name: 'botinfo',
    aliases: ['about'],
    category: CATEGORY,
    description: 'Show information about the bot.',
    async execute(message, args, config, client) {
      const embed = baseEmbed()
        .setTitle('Boat Bot')
        .setDescription('A powerful Discord bot built for easy server management.')
        .addFields(
          { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Uptime', value: formatUptime(client.uptime), inline: true },
          { name: 'Commands', value: `${client.commands.size} slash, ${client.prefixCommandList.length} prefix`, inline: true },
        );
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'uptime',
    category: CATEGORY,
    description: 'Show how long the bot has been running.',
    async execute(message, args, config, client) {
      return message.channel.send(`I have been online for ${formatUptime(client.uptime)}.`);
    },
  },
  {
    name: 'prefix',
    category: CATEGORY,
    description: 'Show or change the prefixes. Usage: prefix | prefix set <symbol> | prefix add <symbol> | prefix remove <symbol> | prefix reset',
    async execute(message, args, config) {
      const action = args[0]?.toLowerCase();
      const symbol = args[1];

      if (action && ['set', 'add', 'remove', 'reset'].includes(action)) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply("You don't have permission to change the prefix.");
        }

        if (action === 'reset') {
          config.prefixes = ['!', '.', '?', ',', '$'];
          saveConfig(message.guild.id);
          return message.channel.send(`Prefixes reset: ${config.prefixes.map((p) => `\`${p}\``).join(', ')}`);
        }

        if (!symbol || symbol.length > 3) return message.reply(`Usage: \`prefix ${action} <symbol>\` (up to 3 characters)`);

        if (action === 'set') {
          config.prefixes = [symbol];
        } else if (action === 'add') {
          if (config.prefixes.includes(symbol)) return message.reply('That prefix is already in use.');
          config.prefixes.push(symbol);
        } else {
          if (!config.prefixes.includes(symbol)) return message.reply('That prefix is not in use.');
          if (config.prefixes.length === 1) return message.reply('You cannot remove the last prefix.');
          config.prefixes = config.prefixes.filter((p) => p !== symbol);
        }

        saveConfig(message.guild.id);
        return message.channel.send(`Prefixes: ${config.prefixes.map((p) => `\`${p}\``).join(', ')} — e.g. \`${config.prefixes[0]}ban\``);
      }

      return message.channel.send(`Prefixes: ${config.prefixes.map((p) => `\`${p}\``).join(', ')} — e.g. \`${config.prefixes[0]}ban\``);
    },
  },
  {
    name: 'channelinfo',
    category: CATEGORY,
    description: 'Show information about this channel.',
    async execute(message) {
      const channel = message.channel;
      const embed = baseEmbed()
        .setTitle(`#${channel.name}`)
        .addFields(
          { name: 'ID', value: channel.id, inline: true },
          { name: 'Category', value: channel.parent ? channel.parent.name : 'None', inline: true },
          { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
          { name: 'Slowmode', value: `${channel.rateLimitPerUser ?? 0}s`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:D>`, inline: true },
        );
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'membercount',
    category: CATEGORY,
    description: "Show this server's member count.",
    async execute(message) {
      return message.channel.send(`👥 ${message.guild.name} has **${message.guild.memberCount}** members.`);
    },
  },
  {
    name: 'id',
    category: CATEGORY,
    description: 'Get the raw ID of a mentioned user, role, or channel. Usage: id <@user|@role|#channel>',
    async execute(message) {
      const target = message.mentions.users.first() ?? message.mentions.roles.first() ?? message.mentions.channels.first();
      if (!target) return message.reply('Usage: `id <@user|@role|#channel>`');
      return message.channel.send(`ID: \`${target.id}\``);
    },
  },
  {
    name: 'firstmessage',
    aliases: ['firstmsg'],
    category: CATEGORY,
    description: 'Get a link to the first message in this channel.',
    async execute(message) {
      const messages = await message.channel.messages.fetch({ after: '0', limit: 1 }).catch(() => null);
      const first = messages?.first();
      if (!first) return message.reply('Could not find the first message in this channel.');
      return message.channel.send(`First message: ${first.url}`);
    },
  },
  {
    name: 'emojis',
    category: CATEGORY,
    description: "List this server's custom emojis.",
    async execute(message) {
      const emojis = message.guild.emojis.cache;
      if (emojis.size === 0) return message.channel.send('This server has no custom emojis.');
      const list = emojis.map((e) => `${e}`).join(' ');
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Emojis (${emojis.size})`).setDescription(list.slice(0, 4000))] });
    },
  },
  {
    name: 'afk',
    category: CATEGORY,
    description: 'Set yourself as AFK. Usage: afk [reason]',
    async execute(message, args, config) {
      const reason = args.join(' ') || 'AFK';
      config.afk[message.author.id] = { reason, timestamp: Date.now() };
      saveConfig(message.guild.id);
      return message.channel.send(`💤 ${message.author.tag} is now AFK: ${reason}`);
    },
  },
  {
    name: 'snipe',
    category: CATEGORY,
    description: 'Show the last deleted message in this channel.',
    async execute(message) {
      const entry = getDeleted(message.channel.id);
      if (!entry) return message.reply('There is nothing to snipe in this channel.');
      const embed = baseEmbed()
        .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatar })
        .setDescription(entry.content || '*No text content*')
        .setFooter({ text: 'Deleted' })
        .setTimestamp(entry.timestamp);
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'editsnipe',
    category: CATEGORY,
    description: 'Show the last edited message in this channel.',
    async execute(message) {
      const entry = getEdited(message.channel.id);
      if (!entry) return message.reply('There is nothing to editsnipe in this channel.');
      const embed = baseEmbed()
        .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatar })
        .addFields(
          { name: 'Before', value: entry.before?.slice(0, 1024) || '*No text content*' },
          { name: 'After', value: entry.after?.slice(0, 1024) || '*No text content*' },
        )
        .setFooter({ text: 'Edited' })
        .setTimestamp(entry.timestamp);
      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'roles',
    category: CATEGORY,
    description: 'List all roles in this server.',
    async execute(message) {
      const roles = message.guild.roles.cache.filter((r) => r.id !== message.guild.id).sort((a, b) => b.position - a.position);
      if (roles.size === 0) return message.channel.send('This server has no roles.');
      const list = roles.map((r) => `${r}`).join(' ');
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Roles (${roles.size})`).setDescription(list.slice(0, 4000))] });
    },
  },
  {
    name: 'channels',
    category: CATEGORY,
    description: 'List all channels in this server.',
    async execute(message) {
      const channels = message.guild.channels.cache.filter((c) => !c.isThread());
      if (channels.size === 0) return message.channel.send('This server has no channels.');
      const list = channels.map((c) => formatChannel(c)).join('\n');
      return message.channel.send({ embeds: [baseEmbed().setTitle(`Channels (${channels.size})`).setDescription(list.slice(0, 4000))] });
    },
  },
  {
    name: 'serverbanner',
    category: CATEGORY,
    description: "Show this server's banner.",
    async execute(message) {
      if (!message.guild.banner) return message.channel.send('This server does not have a banner set.');
      return message.channel.send({
        embeds: [baseEmbed().setTitle(`${message.guild.name}'s banner`).setImage(message.guild.bannerURL({ size: 1024 }))],
      });
    },
  },
];
