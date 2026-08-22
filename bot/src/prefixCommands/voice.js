const { PermissionFlagsBits } = require('discord.js');
const { baseEmbed, COLORS } = require('../utils/embeds');
const { resolveUser } = require('../utils/args');
const { logAction } = require('../utils/logger');

const CATEGORY = 'Moderation';

function resolveVoiceChannel(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<#>]/g, '');
  const byId = message.guild.channels.cache.get(id);
  if (byId?.isVoiceBased()) return byId;
  return message.guild.channels.cache.find((c) => c.isVoiceBased() && c.name.toLowerCase() === arg.toLowerCase()) ?? null;
}

// Discord only accepts a server-mute/deafen/disconnect for someone who is
// actually connected, so every single-member action here shares this lookup.
async function targetInVoice(message, arg, commandName) {
  const user = await resolveUser(message, arg);
  if (!user) return { error: `Usage: \`${commandName} @user\`` };

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return { error: 'That user is not in this server.' };
  if (!member.voice?.channel) return { error: `**${user.tag}** is not in a voice channel.` };

  return { member, user };
}

module.exports = [
  {
    name: 'vckick',
    category: CATEGORY,
    description: 'Disconnect a member from voice. Usage: vckick @user [reason]',
    permissions: [PermissionFlagsBits.MoveMembers],
    async execute(message, args) {
      const target = await targetInVoice(message, args[0], 'vckick');
      if (target.error) return message.reply(target.error);

      const reason = args.slice(1).join(' ') || 'No reason provided';
      const channelName = target.member.voice.channel.name;

      const ok = await target.member.voice.disconnect(reason).then(() => true).catch(() => false);
      if (!ok) return message.reply('I could not disconnect them — check my permissions and role position.');

      await logAction(message.guild, `🔌 **${target.user.tag}** was disconnected from **${channelName}** by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${target.user.tag}** was disconnected from **${channelName}**.`)] });
    },
  },
  {
    name: 'vcmute',
    category: CATEGORY,
    description: 'Server-mute a member in voice. Usage: vcmute @user [reason]',
    permissions: [PermissionFlagsBits.MuteMembers],
    async execute(message, args) {
      const target = await targetInVoice(message, args[0], 'vcmute');
      if (target.error) return message.reply(target.error);
      if (target.member.voice.serverMute) return message.reply(`**${target.user.tag}** is already server-muted.`);

      const reason = args.slice(1).join(' ') || 'No reason provided';
      const ok = await target.member.voice.setMute(true, reason).then(() => true).catch(() => false);
      if (!ok) return message.reply('I could not mute them — check my permissions and role position.');

      await logAction(message.guild, `🔇 **${target.user.tag}** was voice-muted by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${target.user.tag}** has been server-muted.`)] });
    },
  },
  {
    name: 'vcunmute',
    category: CATEGORY,
    description: 'Remove a member\'s server mute. Usage: vcunmute @user',
    permissions: [PermissionFlagsBits.MuteMembers],
    async execute(message, args) {
      const target = await targetInVoice(message, args[0], 'vcunmute');
      if (target.error) return message.reply(target.error);
      if (!target.member.voice.serverMute) return message.reply(`**${target.user.tag}** is not server-muted.`);

      const ok = await target.member.voice.setMute(false, `Unmuted by ${message.author.tag}`).then(() => true).catch(() => false);
      if (!ok) return message.reply('I could not unmute them — check my permissions and role position.');

      await logAction(message.guild, `🔊 **${target.user.tag}** was voice-unmuted by ${message.author.tag}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${target.user.tag}** has been server-unmuted.`)] });
    },
  },
  {
    name: 'deafen',
    category: CATEGORY,
    description: 'Server-deafen a member in voice. Usage: deafen @user [reason]',
    permissions: [PermissionFlagsBits.DeafenMembers],
    async execute(message, args) {
      const target = await targetInVoice(message, args[0], 'deafen');
      if (target.error) return message.reply(target.error);
      if (target.member.voice.serverDeaf) return message.reply(`**${target.user.tag}** is already server-deafened.`);

      const reason = args.slice(1).join(' ') || 'No reason provided';
      const ok = await target.member.voice.setDeaf(true, reason).then(() => true).catch(() => false);
      if (!ok) return message.reply('I could not deafen them — check my permissions and role position.');

      await logAction(message.guild, `🔕 **${target.user.tag}** was voice-deafened by ${message.author.tag}\nReason: ${reason}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${target.user.tag}** has been server-deafened.`)] });
    },
  },
  {
    name: 'undeafen',
    category: CATEGORY,
    description: "Remove a member's server deafen. Usage: undeafen @user",
    permissions: [PermissionFlagsBits.DeafenMembers],
    async execute(message, args) {
      const target = await targetInVoice(message, args[0], 'undeafen');
      if (target.error) return message.reply(target.error);
      if (!target.member.voice.serverDeaf) return message.reply(`**${target.user.tag}** is not server-deafened.`);

      const ok = await target.member.voice.setDeaf(false, `Undeafened by ${message.author.tag}`).then(() => true).catch(() => false);
      if (!ok) return message.reply('I could not undeafen them — check my permissions and role position.');

      await logAction(message.guild, `🔔 **${target.user.tag}** was voice-undeafened by ${message.author.tag}`);
      return message.channel.send({ embeds: [baseEmbed(COLORS.success).setDescription(`**${target.user.tag}** has been server-undeafened.`)] });
    },
  },
  {
    name: 'moveall',
    category: CATEGORY,
    description: 'Move everyone between voice channels. Usage: moveall <to> | moveall <from> <to>',
    permissions: [PermissionFlagsBits.MoveMembers],
    async execute(message, args) {
      // One argument means "from my channel to there"; two is explicit.
      const explicit = args.length >= 2;
      const from = explicit ? resolveVoiceChannel(message, args[0]) : message.member?.voice?.channel;
      const to = resolveVoiceChannel(message, explicit ? args[1] : args[0]);

      if (!to) return message.reply('Usage: `moveall <to>` (from your channel) or `moveall <from> <to>`');
      if (!from) {
        return message.reply(explicit ? 'I could not find that source voice channel.' : 'Join a voice channel first, or use `moveall <from> <to>`.');
      }
      if (from.id === to.id) return message.reply('Those are the same channel.');

      const members = [...from.members.values()];
      if (members.length === 0) return message.reply(`**${from.name}** is empty.`);

      let moved = 0;
      for (const member of members) {
        const ok = await member.voice.setChannel(to, `Moved by ${message.author.tag}`).then(() => true).catch(() => false);
        if (ok) moved += 1;
      }

      await logAction(message.guild, `🔀 ${message.author.tag} moved ${moved} member(s) from **${from.name}** to **${to.name}**`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`Moved **${moved}/${members.length}** member(s) from **${from.name}** to **${to.name}**.`)],
      });
    },
  },
  {
    name: 'dragall',
    category: CATEGORY,
    description: 'Pull everyone in voice into your channel. Usage: dragall',
    permissions: [PermissionFlagsBits.MoveMembers],
    async execute(message) {
      const destination = message.member?.voice?.channel;
      if (!destination) return message.reply('Join a voice channel first — that is where everyone gets pulled to.');

      // Plain arrays here — Collection#flatMap expects to build another
      // Collection, not to flatten arrays of members.
      const targets = [...message.guild.channels.cache.values()]
        .filter((channel) => channel.isVoiceBased() && channel.id !== destination.id)
        .flatMap((channel) => [...channel.members.values()]);

      if (targets.length === 0) return message.reply('Nobody else is in a voice channel.');

      let moved = 0;
      for (const member of targets) {
        const ok = await member.voice.setChannel(destination, `Dragged by ${message.author.tag}`).then(() => true).catch(() => false);
        if (ok) moved += 1;
      }

      await logAction(message.guild, `🧲 ${message.author.tag} dragged ${moved} member(s) into **${destination.name}**`);
      return message.channel.send({
        embeds: [baseEmbed(COLORS.success).setDescription(`Pulled **${moved}/${targets.length}** member(s) into **${destination.name}**.`)],
      });
    },
  },
];
