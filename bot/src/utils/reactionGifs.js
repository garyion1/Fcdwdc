const { fetchJson, verifyMediaUrl, raceForFirstValid } = require('./http');

// Short and no retry — these run in parallel against every source an action
// lists, so the total wait is whichever one answers first, not the sum of
// every source's own timeout.
const FETCH_TIMEOUT_MS = 2500;
const VERIFY_TIMEOUT_MS = 1500;

// Three free, key-less GIF sources. No single one covers every action, so an
// action lists every source that documents it having that category — all of
// them are queried at once and the first one that both answers and verifies
// wins, instead of trying them one at a time.
const SOURCE_FETCHERS = {
  nekosbest: async (endpoint) => {
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, { timeoutMs: FETCH_TIMEOUT_MS, attempts: 1 });
    return data?.results?.[0]?.url ?? null;
  },
  waifupics: async (endpoint) => {
    const data = await fetchJson(`https://waifu.pics/api/sfw/${endpoint}`, { timeoutMs: FETCH_TIMEOUT_MS, attempts: 1 });
    return data?.url ?? null;
  },
  purrbot: async (endpoint) => {
    const data = await fetchJson(`https://purrbot.site/api/img/sfw/${endpoint}/gif`, { timeoutMs: FETCH_TIMEOUT_MS, attempts: 1 });
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

  const tasks = sources.map(([source, endpoint]) => async () => {
    const url = await SOURCE_FETCHERS[source](endpoint).catch(() => null);
    if (!url) return null;
    return (await verifyMediaUrl(url, { timeoutMs: VERIFY_TIMEOUT_MS })) ? url : null;
  });

  return raceForFirstValid(tasks);
}

module.exports = { fetchActionGif, ACTIONS };
