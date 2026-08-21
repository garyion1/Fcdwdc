const { baseEmbed, COLORS } = require('../utils/embeds');
const { fetchJson, USER_AGENT } = require('../utils/http');

const CATEGORY = 'Web';

const UNREACHABLE = 'That service did not respond just now — give it a moment and try again.';

async function runTranslation(message, text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const data = await fetchJson(url);

  // Response shape is [[[translated, original, ...], ...], ..., detectedLang]
  const segments = Array.isArray(data?.[0]) ? data[0] : null;
  if (!segments) return message.reply(UNREACHABLE);

  const translated = segments.map((segment) => segment?.[0] ?? '').join('');
  if (!translated) return message.reply('I could not translate that.');

  const detected = typeof data[2] === 'string' ? data[2] : 'auto';
  return message.channel.send({
    embeds: [
      baseEmbed()
        .setTitle('🌍 Translation')
        .addFields(
          { name: `From (${detected})`, value: text.slice(0, 1024) },
          { name: `To (${target})`, value: translated.slice(0, 1024) },
        ),
    ],
  });
}

module.exports = [
  {
    name: 'weather',
    category: CATEGORY,
    description: 'Look up the weather. Usage: weather <place>',
    async execute(message, args) {
      const place = args.join(' ');
      if (!place) return message.reply('Usage: `weather <place>` e.g. `weather London`');

      const data = await fetchJson(`https://wttr.in/${encodeURIComponent(place)}?format=j1`);
      const current = data?.current_condition?.[0];
      if (!current) return message.reply(`I could not find the weather for **${place}**.`);

      const area = data.nearest_area?.[0];
      const name = [area?.areaName?.[0]?.value, area?.region?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join(', ') || place;
      const today = data.weather?.[0];

      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`🌤️ Weather — ${name}`)
            .setDescription(current.weatherDesc?.[0]?.value ?? 'Unknown conditions')
            .addFields(
              { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
              { name: 'Feels like', value: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`, inline: true },
              { name: 'Humidity', value: `${current.humidity}%`, inline: true },
              { name: 'Wind', value: `${current.windspeedKmph} km/h`, inline: true },
              { name: 'Today', value: today ? `${today.mintempC}°C → ${today.maxtempC}°C` : 'Unknown', inline: true },
              { name: 'Visibility', value: `${current.visibility} km`, inline: true },
            ),
        ],
      });
    },
  },
  {
    name: 'translate',
    aliases: ['tr'],
    category: CATEGORY,
    description: 'Translate a message. Usage: reply to a message with `tr` (or `tr <language>`) — or `tr <language> <text>` on its own.',
    async execute(message, args) {
      const replyId = message.reference?.messageId;
      const repliedMessage = replyId ? await message.channel.messages.fetch(replyId).catch(() => null) : null;

      if (repliedMessage) {
        if (!repliedMessage.content) return message.reply('That message has no text to translate.');
        const langArg = args[0]?.toLowerCase();
        const target = langArg && /^[a-z]{2}(-[a-z]{2})?$/i.test(langArg) ? langArg : 'en';
        return runTranslation(message, repliedMessage.content, target);
      }

      const target = args[0]?.toLowerCase();
      const text = args.slice(1).join(' ');
      if (!target || !text || !/^[a-z]{2}(-[a-z]{2})?$/i.test(target)) {
        return message.reply('Reply to a message with `tr` (or `tr <language>`) to translate it — or use `tr <language> <text>` on its own.');
      }
      return runTranslation(message, text, target);
    },
  },
  {
    name: 'urban',
    aliases: ['ud'],
    category: CATEGORY,
    description: 'Look a term up on Urban Dictionary. Usage: urban <term>',
    async execute(message, args) {
      const term = args.join(' ');
      if (!term) return message.reply('Usage: `urban <term>`');

      if (!message.channel.nsfw) {
        // Urban Dictionary is uncensored, so keep it to age-restricted channels.
        return message.reply('`urban` only works in an age-restricted (NSFW) channel — the definitions are uncensored.');
      }

      const data = await fetchJson(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
      const entry = data?.list?.[0];
      if (!entry) return message.reply(`No Urban Dictionary entry for **${term}**.`);

      const clean = (value) => (value ?? '').replace(/[[\]]/g, '').slice(0, 1024) || '*None*';
      return message.channel.send({
        embeds: [
          baseEmbed()
            .setTitle(`📖 ${entry.word}`)
            .setURL(entry.permalink)
            .setDescription(clean(entry.definition))
            .addFields({ name: 'Example', value: clean(entry.example) })
            .setFooter({ text: `👍 ${entry.thumbs_up}  👎 ${entry.thumbs_down}` }),
        ],
      });
    },
  },
  {
    name: 'wikipedia',
    aliases: ['wiki'],
    category: CATEGORY,
    description: 'Look something up on Wikipedia. Usage: wikipedia <topic>',
    async execute(message, args) {
      const topic = args.join(' ');
      if (!topic) return message.reply('Usage: `wikipedia <topic>`');

      const title = encodeURIComponent(topic.replace(/\s+/g, '_'));
      const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': USER_AGENT } });

      if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
        return message.reply(`I could not find a Wikipedia article for **${topic}**.`);
      }
      if (!data.extract) return message.reply(UNREACHABLE);

      const embed = baseEmbed()
        .setTitle(data.title)
        .setURL(data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`)
        .setDescription(data.extract.slice(0, 4000));
      if (data.thumbnail?.source) embed.setThumbnail(data.thumbnail.source);

      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'google',
    aliases: ['search'],
    category: CATEGORY,
    description: 'Search the web. Usage: google <query>',
    async execute(message, args) {
      const query = args.join(' ');
      if (!query) return message.reply('Usage: `google <query>`');

      const link = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

      // Google has no free search API, so this answers from DuckDuckGo's
      // instant-answer endpoint and always offers the search link as a fallback.
      const data = await fetchJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
      const answer = data?.AbstractText || data?.Answer || data?.Definition || '';
      const related = (data?.RelatedTopics ?? []).map((topic) => topic.Text).filter(Boolean).slice(0, 3);

      const embed = baseEmbed().setTitle(`🔎 ${query}`).setURL(link);
      if (answer) {
        embed.setDescription(answer.slice(0, 2000));
        if (data.AbstractURL) embed.addFields({ name: 'Source', value: data.AbstractURL });
      } else if (related.length > 0) {
        embed.setDescription(related.map((text) => `• ${text}`).join('\n').slice(0, 2000));
      } else {
        embed.setDescription(`No instant answer for that one.\n[Open the search on Google](${link})`);
      }

      return message.channel.send({ embeds: [embed] });
    },
  },
  {
    name: 'nowplaying',
    aliases: ['np', 'play', 'queue', 'skip', 'pause', 'resume', 'volume', 'seek', 'shuffle', 'spotify', 'lastfm'],
    category: CATEGORY,
    description: 'Music and music-service commands (not available on this bot).',
    async execute(message) {
      return message.channel.send({
        embeds: [
          baseEmbed(COLORS.warning)
            .setTitle('🎵 Music is not available')
            .setDescription(
              'Playing audio needs a separate audio server (Lavalink) running alongside the bot, and Spotify and Last.fm need their own developer accounts and per-user sign-in. None of that fits in a single-file bot.\n\n' +
                'Everything else — moderation, tickets, leveling, giveaways, images and text tools — works normally.',
            ),
        ],
      });
    },
  },
];
