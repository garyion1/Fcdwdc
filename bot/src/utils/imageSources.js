const { fetchJson, verifyMediaUrl, USER_AGENT } = require('./http');

const IMAGE_EXTENSIONS = /\.(gif|gifv|jpe?g|png|webp)$/i;

// Reddit's public JSON needs a real User-Agent but no auth. Pulls a batch of
// posts and returns the first one that actually verifies, since a post's
// linked image can be removed or a gallery/video link can slip through the
// extension filter.
async function fetchRedditImage(subreddit) {
  const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=100`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  const posts = data?.data?.children ?? [];
  const candidates = posts
    .map((child) => child.data)
    .filter((post) => post && !post.over_18 && !post.stickied)
    .map((post) => ({
      title: post.title,
      permalink: `https://reddit.com${post.permalink}`,
      // .gifv is a video wrapper; the .gif of the same id renders inline.
      url: (post.url_overridden_by_dest ?? post.url ?? '').replace(/\.gifv$/i, '.gif'),
    }))
    .filter((post) => IMAGE_EXTENSIONS.test(post.url.split('?')[0]));

  // Shuffle so repeated calls (and the multi-subreddit fallback below) don't
  // all land on the same top post.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const candidate of candidates.slice(0, 8)) {
    if (await verifyMediaUrl(candidate.url)) return candidate;
  }
  return null;
}

async function fetchFromRedditFallbacks(subreddits) {
  for (const subreddit of subreddits) {
    const result = await fetchRedditImage(subreddit).catch(() => null);
    if (result) return result;
  }
  return null;
}

async function verified(url) {
  return url && (await verifyMediaUrl(url)) ? { url } : null;
}

// Each kind tries its dedicated free APIs first, then falls back to one or
// more subreddits — every candidate is confirmed to actually load before use.
const SOURCES = {
  cat: async () => {
    const data = await fetchJson('https://api.thecatapi.com/v1/images/search');
    const fromApi = await verified(Array.isArray(data) ? data[0]?.url : null);
    if (fromApi) return fromApi;

    const shibe = await fetchJson('https://shibe.online/api/cats?count=1');
    const fromShibe = await verified(shibe?.[0]);
    if (fromShibe) return fromShibe;

    return fetchFromRedditFallbacks(['cats', 'CatGifs']);
  },
  dog: async () => {
    const data = await fetchJson('https://dog.ceo/api/breeds/image/random');
    const fromApi = await verified(data?.message);
    if (fromApi) return fromApi;

    const shibe = await fetchJson('https://shibe.online/api/shibes?count=1');
    const fromShibe = await verified(shibe?.[0]);
    if (fromShibe) return fromShibe;

    return fetchFromRedditFallbacks(['dogpictures', 'DogGifs']);
  },
  fox: async () => {
    const data = await fetchJson('https://randomfox.ca/floof/');
    const fromApi = await verified(data?.image);
    if (fromApi) return fromApi;
    return fetchFromRedditFallbacks(['foxes', 'FoxGifs']);
  },
  duck: async () => {
    const data = await fetchJson('https://random-d.uk/api/v2/random');
    const fromApi = await verified(data?.url);
    if (fromApi) return fromApi;
    return fetchFromRedditFallbacks(['duck']);
  },
  bird: async () => {
    const shibe = await fetchJson('https://shibe.online/api/birds?count=1');
    const fromShibe = await verified(shibe?.[0]);
    if (fromShibe) return fromShibe;
    return fetchFromRedditFallbacks(['birdpics', 'birding']);
  },
  panda: () => fetchFromRedditFallbacks(['panda', 'redpandas']),
  frog: () => fetchFromRedditFallbacks(['frogs', 'redditfrogs']),
  meme: () => fetchFromRedditFallbacks(['memes', 'dankmemes', 'wholesomememes']),
};

async function fetchImage(kind) {
  const source = SOURCES[kind];
  if (!source) return null;
  return source().catch(() => null);
}

module.exports = { fetchImage, fetchRedditImage, SOURCES };
