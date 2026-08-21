const { fetchJson, USER_AGENT } = require('./http');

const IMAGE_EXTENSIONS = /\.(gif|gifv|jpe?g|png|webp)$/i;

// Reddit's public JSON needs a real User-Agent but no auth. Used for the
// animals that have no dedicated free API of their own.
async function fetchRedditImage(subreddit) {
  const data = await fetchJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=100`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  const posts = data?.data?.children ?? [];
  const usable = posts
    .map((child) => child.data)
    .filter((post) => post && !post.over_18 && !post.stickied)
    .map((post) => ({
      title: post.title,
      permalink: `https://reddit.com${post.permalink}`,
      url: post.url_overridden_by_dest ?? post.url,
    }))
    .filter((post) => typeof post.url === 'string' && IMAGE_EXTENSIONS.test(post.url.split('?')[0]));

  if (usable.length === 0) return null;
  const picked = usable[Math.floor(Math.random() * usable.length)];
  // .gifv is a video wrapper; the .gif of the same id renders inline.
  picked.url = picked.url.replace(/\.gifv$/i, '.gif');
  return picked;
}

const SOURCES = {
  cat: async () => {
    const data = await fetchJson('https://api.thecatapi.com/v1/images/search');
    const url = Array.isArray(data) ? data[0]?.url : null;
    return url ? { url } : fetchRedditImage('cats');
  },
  dog: async () => {
    const data = await fetchJson('https://dog.ceo/api/breeds/image/random');
    return data?.message ? { url: data.message } : fetchRedditImage('dogpictures');
  },
  fox: async () => {
    const data = await fetchJson('https://randomfox.ca/floof/');
    return data?.image ? { url: data.image } : fetchRedditImage('foxes');
  },
  duck: async () => {
    const data = await fetchJson('https://random-d.uk/api/v2/random');
    return data?.url ? { url: data.url } : fetchRedditImage('duck');
  },
  panda: () => fetchRedditImage('panda'),
  bird: () => fetchRedditImage('birdpics'),
  frog: () => fetchRedditImage('frogs'),
  meme: () => fetchRedditImage('memes'),
};

async function fetchImage(kind) {
  const source = SOURCES[kind];
  if (!source) return null;
  return source().catch(() => null);
}

module.exports = { fetchImage, fetchRedditImage, SOURCES };
