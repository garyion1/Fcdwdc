const Anthropic = require('@anthropic-ai/sdk');
const { baseEmbed, COLORS } = require('../utils/embeds');

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const CATEGORY = 'AI';
const MAX_EMBED_LENGTH = 4000;

module.exports = [
  {
    name: 'ai',
    category: CATEGORY,
    description: 'Ask Claude a question. Usage: ai ask <question>',
    async execute(message, args) {
      if (args[0]?.toLowerCase() !== 'ask') return message.reply('Usage: `ai ask <question>`');
      const question = args.slice(1).join(' ');
      if (!question) return message.reply('Usage: `ai ask <question>`, e.g. `ai ask What is the capital of France?`');

      if (!anthropic) {
        return message.reply('AI features are not configured — the bot operator needs to set an `ANTHROPIC_API_KEY`.');
      }

      await message.channel.sendTyping().catch(() => {});

      let response;
      try {
        response = await anthropic.beta.messages.create({
          model: 'claude-opus-5',
          max_tokens: 1024,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          messages: [{ role: 'user', content: question }],
        });
      } catch (error) {
        console.error('AI ask error:', error);
        return message.reply('Something went wrong asking Claude. Try again in a moment.');
      }

      if (response.stop_reason === 'refusal') {
        return message.reply("Claude couldn't answer that one — try rephrasing.");
      }

      const textBlock = response.content.find((b) => b.type === 'text');
      let answer = textBlock?.text ?? "Claude didn't return a text response.";
      if (answer.length > MAX_EMBED_LENGTH) answer = `${answer.slice(0, MAX_EMBED_LENGTH)}…`;

      return message.channel.send({ embeds: [baseEmbed(COLORS.primary).setTitle('🤖 Claude').setDescription(answer)] });
    },
  },
];
