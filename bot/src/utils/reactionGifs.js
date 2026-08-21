const { fetchJson, verifyMediaUrl } = require('./http');

// Three free, key-less GIF sources, tried in order. No single one covers
// every action, and any one of them can be slow or briefly down, so an
// action lists every source that documents it having that category — the
// first candidate that actually resolves (checked with verifyMediaUrl) wins.
const SOURCE_FETCHERS = {
  nekosbest: async (endpoint) => {
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`);
    return data?.results?.[0]?.url ?? null;
  },
  waifupics: async (endpoint) => {
    const data = await fetchJson(`https://waifu.pics/api/sfw/${endpoint}`);
    return data?.url ?? null;
  },
  purrbot: async (endpoint) => {
    const data = await fetchJson(`https://purrbot.site/api/img/sfw/${endpoint}/gif`);
    return data?.link ?? null;
  },
};

// endpoint name per source, only listed where that source actually documents
// the category — an action with one source just has one entry.
const ACTIONS = {
  hug: [['nekosbest', 'hug'], ['waifupics', 'hug'], ['purrbot', 'hug']],
  kiss: [['nekosbest', 'kiss'], ['waifupics', 'kiss'], ['purrbot', 'kiss']],
  slap: [['nekosbest', 'slap'], ['waifupics', 'slap'], ['purrbot', 'slap']],
  pat: [['nekosbest', 'pat'], ['waifupics', 'pat'], ['purrbot', 'pat']],
  cuddle: [['nekosbest', 'cuddle'], ['waifupics', 'cuddle'], ['purrbot', 'cuddle']],
  poke: [['nekosbest', 'poke'], ['waifupics', 'poke'], ['purrbot', 'poke']],
  lick: [['waifupics', 'lick'], ['purrbot', 'lick']],
  bonk: [['waifupics', 'bonk']],
  highfive: [['nekosbest', 'highfive'], ['waifupics', 'highfive']],
  bite: [['nekosbest', 'bite'], ['waifupics', 'bite']],
  punch: [['nekosbest', 'punch']],
  stare: [['nekosbest', 'stare']],
  smile: [['nekosbest', 'smile'], ['waifupics', 'smile']],
  wave: [['nekosbest', 'wave'], ['waifupics', 'wave']],
  cry: [['nekosbest', 'cry'], ['waifupics', 'cry']],
  laugh: [['nekosbest', 'laugh']],
  angry: [['nekosbest', 'angry'], ['nekosbest', 'pout']],
  blush: [['nekosbest', 'blush'], ['waifupics', 'blush']],
  dance: [['nekosbest', 'dance'], ['waifupics', 'dance']],
};

async function fetchActionGif(action) {
  const sources = ACTIONS[action];
  if (!sources) return null;

  for (const [source, endpoint] of sources) {
    const url = await SOURCE_FETCHERS[source](endpoint).catch(() => null);
    if (url && (await verifyMediaUrl(url))) return url;
  }
  return null;
}

module.exports = { fetchActionGif, ACTIONS };
