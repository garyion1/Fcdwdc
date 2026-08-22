const { AttachmentBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { renderQuoteCard } = require('../utils/quoteCard');

const CATEGORY = 'Fun';
const MAX_QUOTE_LENGTH = 280;

module.exports = [
  {
    name: 'quote',
    category: CATEGORY,
    description: 'Turn a line into a quote image. Usage: quote <text> — or reply to a message with `quote`.',
    async execute(message, args) {
      // Replying quotes that message and credits its author; otherwise it
      // quotes whatever you typed, credited to you.
      const replyId = message.reference?.messageId;
      const replied = replyId ? await message.channel.messages.fetch(replyId).catch(() => null) : null;

      let text;
      let author;

      if (replied && args.length === 0) {
        if (!replied.content) return message.reply('That message has no text to quote.');
        text = replied.content;
        author = replied.author;
      } else {
        text = args.join(' ');
        author = message.author;
        if (!text) return message.reply('Usage: `quote <text>` — or reply to a message with `quote`.');
      }

      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > MAX_QUOTE_LENGTH) text = `${text.slice(0, MAX_QUOTE_LENGTH - 1).trimEnd()}…`;

      const member = await message.guild.members.fetch(author.id).catch(() => null);
      const name = member?.displayName ?? author.username;
      const avatarUrl = (member ?? author).displayAvatarURL({ extension: 'png', size: 512 });

      const png = await renderQuoteCard({ text, name, avatarUrl });

      if (png) {
        return message.channel
          .send({ files: [new AttachmentBuilder(png, { name: 'quote.png' })] })
          .catch(() => {});
      }

      // Image rendering unavailable on this host — still deliver the quote.
      return message.channel
        .send({
          embeds: [
            baseEmbed()
              .setAuthor({ name, iconURL: avatarUrl })
              .setDescription(`> ${text}`)
              .setFooter({ text: `— ${name}` }),
          ],
        })
        .catch(() => {});
    },
  },
];
