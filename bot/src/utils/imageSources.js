const { fetchJson, verifyMediaUrl, raceForFirstValid, USER_AGENT } = require('./http');

const IMAGE_EXTENSIONS = /\.(gif|gifv|jpe?g|png|webp)$/i;

// Short and no retry — every source for a kind runs in parallel, so the total
// wait is whichever one answers first, not the sum of each source's timeout.
const FETCH_TIMEOUT_MS = 2500;
const VERIFY_TIMEOUT_MS = 1200;
// How many of a subreddit's posts to check before giving up on it — checked
// in parallel with everything else, so this only bounds one source's work,
// not the whole command.
const REDDIT_CANDIDATES = 4;

// Reddit's public JSON needs a real User-Agent but no auth. Checks a handful
// of candidate posts in parallel — a post's linked image can be removed, or a
// gallery/video link can slip through the extension filter.
async function fetchRedditImage(subreddit) {
  const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=100`, {
    headers: { 'User-Agent': USER_AGENT },
    timeoutMs: FETCH_TIMEOUT_MS,
    attempts: 1,
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

  // Shuffle so repeated calls don't all land on the same top post.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const tasks = candidates
    .slice(0, REDDIT_CANDIDATES)
    .map((candidate) => async () => ((await verifyMediaUrl(candidate.url, { timeoutMs: VERIFY_TIMEOUT_MS })) ? candidate : null));
  return raceForFirstValid(tasks);
}

async function fetchFromRedditFallbacks(subreddits) {
  return raceForFirstValid(subreddits.map((subreddit) => () => fetchRedditImage(subreddit).catch(() => null)));
}

function apiTask(url, extract) {
  return async () => {
    const data = await fetchJson(url, { timeoutMs: FETCH_TIMEOUT_MS, attempts: 1 });
    const candidate = extract(data);
    if (!candidate) return null;
    return (await verifyMediaUrl(candidate, { timeoutMs: VERIFY_TIMEOUT_MS })) ? { url: candidate } : null;
  };
}

function redditTask(subreddits) {
  return () => fetchFromRedditFallbacks(subreddits);
}

// Every kind races its dedicated free APIs and its subreddit fallbacks all at
// once — whichever candidate answers and verifies first wins, instead of
// working through the list one source at a time.
const SOURCES = {
  cat: () =>
    raceForFirstValid([
      apiTask('https://api.thecatapi.com/v1/images/search', (data) => (Array.isArray(data) ? data[0]?.url : null)),
      apiTask('https://shibe.online/api/cats?count=1', (data) => data?.[0]),
      redditTask(['cats', 'CatGifs']),
    ]),
  dog: () =>
    raceForFirstValid([
      apiTask('https://dog.ceo/api/breeds/image/random', (data) => data?.message),
      apiTask('https://shibe.online/api/shibes?count=1', (data) => data?.[0]),
      redditTask(['dogpictures', 'DogGifs']),
    ]),
  fox: () => raceForFirstValid([apiTask('https://randomfox.ca/floof/', (data) => data?.image), redditTask(['foxes', 'FoxGifs'])]),
  duck: () => raceForFirstValid([apiTask('https://random-d.uk/api/v2/random', (data) => data?.url), redditTask(['duck'])]),
  bird: () => raceForFirstValid([apiTask('https://shibe.online/api/birds?count=1', (data) => data?.[0]), redditTask(['birdpics', 'birding'])]),
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
