const { fetchText, USER_AGENT } = require('./http');

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// DuckDuckGo's key-less HTML endpoint has no documented contract — it can
// change layout without notice — so this stays deliberately tolerant: any
// parse failure just yields zero results rather than throwing, and the
// caller falls back to the instant-answer API when that happens.
async function searchWeb(query, limit = 5) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!html) return [];

  const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const titles = [];
  let match;
  while (titles.length < limit && (match = titleRe.exec(html))) {
    let href = match[1];
    const redirectTarget = /[?&]uddg=([^&]+)/.exec(href);
    if (redirectTarget) href = decodeURIComponent(redirectTarget[1]);
    else if (href.startsWith('//')) href = `https:${href}`;

    if (!/^https?:\/\//i.test(href)) continue;
    titles.push({ title: stripTags(match[2]), url: href });
  }

  const snippets = [];
  while (snippets.length < limit && (match = snippetRe.exec(html))) {
    snippets.push(stripTags(match[1]));
  }

  return titles.map((entry, index) => ({ ...entry, snippet: snippets[index] ?? '' }));
}

module.exports = { searchWeb };
