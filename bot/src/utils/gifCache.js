const { db } = require('../config/db');
const { fetchJson, verifyMediaUrl, USER_AGENT } = require('./http');

// How many URLs each category (e.g. "action:hug", "image:cat") tries to keep
// on hand. Some categories draw from a small underlying pool on the source
// side and will plateau below this — that's fine, the cache just keeps
// whatever it could verify.
const TARGET_POOL_SIZE = 100;
// Refreshed on this interval so dead links get cycled out and the pool stays
// current — not because 100 preloaded gifs "expire".
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
// How many times a single source gets asked (across all its calls) while
// filling one category — bounds the worst case for a source with a small
// underlying pool that just keeps handing back near-duplicates.
const ATTEMPTS_PER_SOURCE = 8;
// How many categories warm up at once — keeps 27 categories × several
// sources each from all hitting the network in the same instant.
const CONCURRENT_CATEGORIES = 4;

const getCacheStmt = db.prepare('SELECT urls FROM gif_cache WHERE category = ?');
const upsertCacheStmt = db.prepare(`
  INSERT INTO gif_cache (category, urls, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(category) DO UPDATE SET urls = excluded.urls, updated_at = excluded.updated_at
`);

const memoryCache = new Map();

function loadFromDb(category) {
  const row = getCacheStmt.get(category);
  if (!row) return [];
  try {
    const urls = JSON.parse(row.urls);
    return Array.isArray(urls) ? urls : [];
  } catch {
    return [];
  }
}

function ensureLoaded(category) {
  if (!memoryCache.has(category)) memoryCache.set(category, loadFromDb(category));
  return memoryCache.get(category);
}

// Instant, no network — the whole point of the cache.
function pickRandomCached(category) {
  const urls = ensureLoaded(category);
  if (urls.length === 0) return null;
  return urls[Math.floor(Math.random() * urls.length)];
}

function poolSize(category) {
  return ensureLoaded(category).length;
}

function saveCache(category, urls) {
  memoryCache.set(category, urls);
  upsertCacheStmt.run(category, JSON.stringify(urls), Date.now());
}

function nekosBestFactory(endpoint) {
  return async () => {
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}?amount=20`, { timeoutMs: 6000, attempts: 1 });
    return (data?.results ?? []).map((r) => r.url).filter(Boolean);
  };
}
function waifuPicsFactory(endpoint) {
  return async () => {
    const data = await fetchJson(`https://waifu.pics/api/sfw/${endpoint}`, { timeoutMs: 4000, attempts: 1 });
    return data?.url ? [data.url] : [];
  };
}
function purrbotFactory(endpoint) {
  return async () => {
    const data = await fetchJson(`https://purrbot.site/api/img/sfw/${endpoint}/gif`, { timeoutMs: 4000, attempts: 1 });
    return data?.link ? [data.link] : [];
  };
}

function catApiFactory() {
  return async () => {
    const data = await fetchJson('https://api.thecatapi.com/v1/images/search?limit=100', { timeoutMs: 6000, attempts: 1 });
    return Array.isArray(data) ? data.map((d) => d.url).filter(Boolean) : [];
  };
}
function shibeFactory(kind) {
  return async () => {
    const data = await fetchJson(`https://shibe.online/api/${kind}?count=100`, { timeoutMs: 6000, attempts: 1 });
    return Array.isArray(data) ? data : [];
  };
}
function dogCeoFactory() {
  return async () => {
    const data = await fetchJson('https://dog.ceo/api/breeds/image/random/50', { timeoutMs: 6000, attempts: 1 });
    return Array.isArray(data?.message) ? data.message : [];
  };
}
function randomFoxFactory() {
  return async () => {
    const data = await fetchJson('https://randomfox.ca/floof/', { timeoutMs: 4000, attempts: 1 });
    return data?.image ? [data.image] : [];
  };
}
function randomDuckFactory() {
  return async () => {
    const data = await fetchJson('https://random-d.uk/api/v2/random', { timeoutMs: 4000, attempts: 1 });
    return data?.url ? [data.url] : [];
  };
}

const IMAGE_EXTENSIONS = /\.(gif|gifv|jpe?g|png|webp)$/i;

function redditFactory(subreddit) {
  return async () => {
    const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=100`, {
      headers: { 'User-Agent': USER_AGENT },
      timeoutMs: 6000,
      attempts: 1,
    });
    const posts = data?.data?.children ?? [];
    return posts
      .map((child) => child.data)
      .filter((post) => post && !post.over_18 && !post.stickied)
      .map((post) => (post.url_overridden_by_dest ?? post.url ?? '').replace(/\.gifv$/i, '.gif'))
      .filter((url) => IMAGE_EXTENSIONS.test(url.split('?')[0]));
  };
}

// Same endpoint/source layout as the live-fetch fallbacks in reactionGifs.js
// and imageSources.js — only listed where that source actually documents
// having the category, now querying in bulk instead of one-at-a-time.
const ACTION_FACTORIES = {
  hug: [nekosBestFactory('hug'), waifuPicsFactory('hug'), purrbotFactory('hug')],
  kiss: [nekosBestFactory('kiss'), waifuPicsFactory('kiss'), purrbotFactory('kiss')],
  slap: [nekosBestFactory('slap'), waifuPicsFactory('slap'), purrbotFactory('slap')],
  pat: [nekosBestFactory('pat'), waifuPicsFactory('pat'), purrbotFactory('pat')],
  cuddle: [nekosBestFactory('cuddle'), waifuPicsFactory('cuddle'), purrbotFactory('cuddle')],
  poke: [nekosBestFactory('poke'), waifuPicsFactory('poke'), purrbotFactory('poke')],
  lick: [waifuPicsFactory('lick'), purrbotFactory('lick')],
  bonk: [waifuPicsFactory('bonk')],
  highfive: [nekosBestFactory('highfive'), waifuPicsFactory('highfive')],
  bite: [nekosBestFactory('bite'), waifuPicsFactory('bite')],
  punch: [nekosBestFactory('punch')],
  stare: [nekosBestFactory('stare')],
  smile: [nekosBestFactory('smile'), waifuPicsFactory('smile')],
  wave: [nekosBestFactory('wave'), waifuPicsFactory('wave')],
  cry: [nekosBestFactory('cry'), waifuPicsFactory('cry')],
  laugh: [nekosBestFactory('laugh')],
  angry: [nekosBestFactory('angry'), nekosBestFactory('pout')],
  blush: [nekosBestFactory('blush'), waifuPicsFactory('blush')],
  dance: [nekosBestFactory('dance'), waifuPicsFactory('dance')],
};

const IMAGE_FACTORIES = {
  cat: [catApiFactory(), shibeFactory('cats'), redditFactory('cats'), redditFactory('CatGifs')],
  dog: [dogCeoFactory(), shibeFactory('shibes'), redditFactory('dogpictures'), redditFactory('DogGifs')],
  fox: [randomFoxFactory(), redditFactory('foxes'), redditFactory('FoxGifs')],
  duck: [randomDuckFactory(), redditFactory('duck')],
  bird: [shibeFactory('birds'), redditFactory('birdpics'), redditFactory('birding')],
  panda: [redditFactory('panda'), redditFactory('redpandas')],
  frog: [redditFactory('frogs'), redditFactory('redditfrogs')],
  meme: [redditFactory('memes'), redditFactory('dankmemes'), redditFactory('wholesomememes')],
};

function categoryList() {
  return [
    ...Object.entries(ACTION_FACTORIES).map(([action, factories]) => [`action:${action}`, factories]),
    ...Object.entries(IMAGE_FACTORIES).map(([kind, factories]) => [`image:${kind}`, factories]),
  ];
}

// Fills one category's pool by querying every source for it concurrently —
// a source that comes back empty (down, blocked, or genuinely exhausted)
// stops being retried rather than being hammered ATTEMPTS_PER_SOURCE times.
//
// Starts from what's already cached rather than from nothing: existing URLs
// are re-verified (catching ones that have gone dead since last time) and
// kept if they still work, then topped back up to target with fresh finds.
// This means a degraded refresh (some sources down) only tops up the pool
// instead of replacing 100 good URLs with whatever the working sources
// managed in one cycle.
async function warmCategory(category, factories, target) {
  const found = new Set();

  await Promise.all(
    ensureLoaded(category).map(async (url) => {
      if (await verifyMediaUrl(url, { timeoutMs: 3500 })) found.add(url);
    }),
  );

  async function runFactory(factory) {
    let attempts = 0;
    while (found.size < target && attempts < ATTEMPTS_PER_SOURCE) {
      attempts += 1;
      const candidates = await factory().catch(() => []);
      if (candidates.length === 0) break;

      for (const url of candidates) {
        if (found.size >= target) break;
        if (found.has(url)) continue;
        if (await verifyMediaUrl(url, { timeoutMs: 3500 })) found.add(url);
      }
    }
  }

  await Promise.all(factories.map(runFactory));
  return [...found];
}

async function warmAllPools() {
  const categories = categoryList();
  let index = 0;

  async function worker() {
    while (index < categories.length) {
      const [category, factories] = categories[index];
      index += 1;
      const urls = await warmCategory(category, factories, TARGET_POOL_SIZE).catch(() => []);
      if (urls.length > 0) saveCache(category, urls);
      console.log(`Gif cache: ${category} -> ${urls.length} url(s).`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENT_CATEGORIES }, worker));
}

function startGifCacheWarmer() {
  warmAllPools().catch((error) => console.error('Gif cache warm-up error:', error));
  setInterval(() => {
    warmAllPools().catch((error) => console.error('Gif cache refresh error:', error));
  }, REFRESH_INTERVAL_MS);
}

// For a status command: every category's current pool size.
function poolSizes() {
  return categoryList().map(([category]) => ({ category, size: poolSize(category) }));
}

// Test-only: drops a category's cache from memory and disk, so a test can
// start from a known-empty pool instead of whatever an earlier warm-up left
// behind. Never called from production code paths.
function _clearForTests(category) {
  memoryCache.delete(category);
  db.prepare('DELETE FROM gif_cache WHERE category = ?').run(category);
}

module.exports = { pickRandomCached, poolSize, poolSizes, warmAllPools, startGifCacheWarmer, TARGET_POOL_SIZE, _clearForTests };
