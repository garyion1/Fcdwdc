const { baseEmbed } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');

const CATEGORY = 'Utility';

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
    description: 'Show the prefixes this server uses.',
    async execute(message, args, config) {
      return message.channel.send(`My prefixes here are: ${config.prefixes.map((p) => `\`${p}\``).join(', ')}`);
    },
  },
];
