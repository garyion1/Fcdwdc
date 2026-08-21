const { fetchJson } = require('./http');

// Two free, key-less GIF sources. Neither covers every action on its own, so
// each action names the source that actually has it.
const NEKOS = 'nekos';
const WAIFU = 'waifu';

const ACTIONS = {
  hug: { source: NEKOS, endpoint: 'hug' },
  kiss: { source: NEKOS, endpoint: 'kiss' },
  slap: { source: NEKOS, endpoint: 'slap' },
  pat: { source: NEKOS, endpoint: 'pat' },
  cuddle: { source: NEKOS, endpoint: 'cuddle' },
  poke: { source: NEKOS, endpoint: 'poke' },
  highfive: { source: NEKOS, endpoint: 'highfive' },
  smile: { source: NEKOS, endpoint: 'smile' },
  wave: { source: NEKOS, endpoint: 'wave' },
  cry: { source: NEKOS, endpoint: 'cry' },
  laugh: { source: NEKOS, endpoint: 'laugh' },
  angry: { source: NEKOS, endpoint: 'angry' },
  blush: { source: NEKOS, endpoint: 'blush' },
  bite: { source: NEKOS, endpoint: 'bite' },
  punch: { source: NEKOS, endpoint: 'punch' },
  stare: { source: NEKOS, endpoint: 'stare' },
  dance: { source: NEKOS, endpoint: 'dance' },
  // nekos.best has no bonk or lick; waifu.pics does.
  bonk: { source: WAIFU, endpoint: 'bonk' },
  lick: { source: WAIFU, endpoint: 'lick' },
};

async function fetchActionGif(action) {
  const entry = ACTIONS[action];
  if (!entry) return null;

  if (entry.source === NEKOS) {
    const data = await fetchJson(`https://nekos.best/api/v2/${entry.endpoint}`);
    return data?.results?.[0]?.url ?? null;
  }

  const data = await fetchJson(`https://waifu.pics/api/sfw/${entry.endpoint}`);
  return data?.url ?? null;
}

module.exports = { fetchActionGif, ACTIONS };
